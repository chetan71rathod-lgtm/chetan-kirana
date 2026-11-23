
import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';

const WHATSAPP = '919307451094';
const UPI_ID = 'Q801760632@ybl';

const sampleProducts = [
  {id:'sample-1',name:'अंडे (6 पीस)',category:'डेयरी एवं अंडे',price:48,unit:'पैक',description:'ताज़े अंडे'},
  {id:'sample-2',name:'चीनी',category:'किराना',price:48,unit:'किलो',description:'दैनिक उपयोग की चीनी'},
  {id:'sample-3',name:'तूर दाल',category:'दालें',price:145,unit:'किलो',description:'साफ-सुथरी तूर दाल'},
  {id:'sample-4',name:'चावल',category:'चावल',price:60,unit:'किलो',description:'रोज़ाना उपयोग के लिए'}
];

export default function App() {
  if (window.location.pathname === '/admin') return <AdminPanel />;
  return <Storefront />;
}

function Storefront() {
  const [products, setProducts] = useState(sampleProducts);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('सभी');
  const [form, setForm] = useState({
    name:'',
    mobile:'',
    address:'',
    note:'',
    payment:'COD'
  });
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

const [lastUpiOrder, setLastUpiOrder] = useState(null);
const [utr, setUtr] = useState('');
const [utrSubmitting, setUtrSubmitting] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    if (!supabase) return;

    const {data,error} = await supabase
      .from('products')
      .select(`
        id,
        name,
        category_id,
        price,
        description,
        image_url,
        stock,
        is_active,
        category:categories(name)
      `)
      .eq('is_active',true)
      .order('name');

    if (error) {
      console.error('Product loading error:',error);
      setMessage('उत्पाद लोड नहीं हो पाए। कृपया पेज Refresh करें।');
      return;
    }

    const realProducts = (data || []).map(p => ({
      ...p,
      category: p.category?.name || 'अन्य',
      unit: 'पीस'
    }));

    const realNames = new Set(
      realProducts.map(p => p.name.trim().toLowerCase())
    );

    const remainingSamples = sampleProducts.filter(
      p => !realNames.has(p.name.trim().toLowerCase())
    );

    setProducts([...realProducts,...remainingSamples]);
  }

  const categories = [
    'सभी',
    ...new Set(products.map(p => p.category).filter(Boolean))
  ];

  const visibleProducts = products.filter(p =>
    (category === 'सभी' || p.category === category) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const subtotal = cart.reduce(
    (sum,p) => sum + Number(p.price)*p.qty,
    0
  );

  const delivery = subtotal === 0 || subtotal >= 500 ? 0 : 20;
  const total = subtotal + delivery;

  function changeQuantity(product,quantity) {
    setCart(current => {
      const existing = current.find(p => p.id === product.id);

      if (quantity <= 0) {
        return current.filter(p => p.id !== product.id);
      }

      if (existing) {
        return current.map(p =>
          p.id === product.id ? {...p,qty:quantity} : p
        );
      }

      return [...current,{...product,qty:quantity}];
    });
  }

  function buyNow(product) {
    const existing = cart.find(p => p.id === product.id);
    changeQuantity(product,existing ? existing.qty : 1);

    setTimeout(() => {
      document.getElementById('checkout-panel')?.scrollIntoView({
        behavior:'smooth',
        block:'start'
      });
    },100);
  }

  async function checkout() {
    setMessage('');

    if (!cart.length) {
      return setMessage('पहले कार्ट में सामान जोड़ें।');
    }

    if (!form.name.trim() || !form.mobile.trim() || !form.address.trim()) {
      return setMessage('कृपया नाम, मोबाइल नंबर और पूरा पता भरें।');
    }

    if (!/^[6-9][0-9]{9}$/.test(form.mobile.trim())) {
      return setMessage('कृपया सही 10 अंकों का मोबाइल नंबर लिखें।');
    }

    if (!supabase) {
      return setMessage('Database कनेक्शन उपलब्ध नहीं है।');
    }

    const containsSample = cart.some(p =>
      String(p.id).startsWith('sample-')
    );

    if (containsSample) {
      return setMessage(
        'आपके कार्ट में Demo Product है। कृपया केवल दुकान के असली Products चुनें।'
      );
    }

    setSubmitting(true);

    try {
      const {data,error} = await supabase.rpc(
        'create_customer_order',
        {
          p_customer_name:form.name.trim(),
          p_mobile:form.mobile.trim(),
          p_address:form.address.trim(),
          p_note:form.note.trim(),
          p_payment_method:form.payment,
          p_items:cart.map(p => ({
            product_id:Number(p.id),
            quantity:p.qty
          }))
        }
      );

      if (error) {
        console.error('Order creation error:',error);
        setMessage('ऑर्डर सेव नहीं हुआ। कृपया दोबारा कोशिश करें।');
        return;
      }

      if (!data || !data.success || !data.order_number) {
        setMessage('ऑर्डर की पुष्टि नहीं हो सकी। दुकान से संपर्क करें।');
        return;
      }

      setCart([]);

if (form.payment === 'UPI') {
  setLastUpiOrder({
    orderNumber: data.order_number,
    mobile: form.mobile.trim()
  });
  setUtr('');
}

      setMessage(
        `🎉 आपका ऑर्डर सफलतापूर्वक सेव हो गया! Order ID: ${data.order_number} | कुल राशि: ₹${data.total} | भुगतान: ${form.payment === 'COD' ? 'Cash on Delivery' : 'UPI'}`
      );

    } catch (error) {
      console.error(error);
      setMessage('कुछ तकनीकी समस्या आई। कृपया दोबारा कोशिश करें।');
    } finally {
      setSubmitting(false);
    }
  }

async function submitUpiReference() {
  if (!utr.trim()) {
    return setMessage('कृपया UTR / Transaction ID भरें।');
  }

  setUtrSubmitting(true);
  setMessage('');

  const { data, error } = await supabase.rpc(
    'submit_upi_reference',
    {
      p_order_number: lastUpiOrder.orderNumber,
      p_mobile: lastUpiOrder.mobile,
      p_reference: utr.trim()
    }
  );

  setUtrSubmitting(false);

  if (error) {
    setMessage('UTR Submit Error: ' + error.message);
    return;
  }

  if (!data?.success) {
    setMessage(data?.message || 'UTR जमा नहीं हुआ।');
    return;
  }

  setMessage('आपका UTR सफलतापूर्वक जमा हो गया। भुगतान दुकान द्वारा Verify किया जाएगा।');
  setLastUpiOrder(null);
  setUtr('');
}

  return <>
    <header>
      <div className="brand">
        <div className="logo">
          <span>CK</span>
          <i>🛒</i>
        </div>
        <div>
          <h1>Chetan Kirana</h1>
          <small>आपकी अपनी ऑनलाइन किराना दुकान</small>
        </div>
      </div>

      <a
        className="whatsapp"
        href={`https://wa.me/${WHATSAPP}`}
        target="_blank"
        rel="noreferrer"
      >
        WhatsApp
      </a>
    </header>

    <main>
      <section className="hero">
        <div>
          <span className="tag">CHIKHALI • 5 KM DELIVERY</span>
          <h2>रोज़मर्रा का सामान,<br/>अब घर बैठे मंगाएँ!</h2>
          <p>आसान ऑर्डर • भरोसेमंद सेवा • चिखली में डिलीवरी</p>
        </div>
        <div className="hero-icon">🛒</div>
      </section>

      <p className="notice">
        ₹500 या उससे अधिक की खरीदारी पर डिलीवरी मुफ़्त।
        ₹500 से कम पर ₹20 डिलीवरी चार्ज।
      </p>

      <section className="panel">
        <div className="section-heading">
          <h2>सामान चुनें</h2>
          <span>{products.length} उत्पाद</span>
        </div>

        <input
          className="search"
          placeholder="सामान खोजें..."
          value={search}
          onChange={e=>setSearch(e.target.value)}
        />

        <div className="chips">
          {categories.map(c =>
            <button
              key={c}
              className={category===c?'selected':''}
              onClick={()=>setCategory(c)}
            >
              {c}
            </button>
          )}
        </div>

        <div className="products">
          {visibleProducts.map(p =>
            <article className="product" key={p.id}>
              <div className="product-image">
                {p.image_url
                  ? <img src={p.image_url} alt={p.name}/>
                  : <span>🛍️</span>}
              </div>

              <div className="product-info">
                <b>{p.name}</b>
                <small>{p.description || p.unit || ''}</small>

                <strong>
                  ₹{p.price} <small>/{p.unit || 'पीस'}</small>
                </strong>

                {cart.some(x=>x.id===p.id) &&
                  <div className="quantity">
                    <button onClick={()=>
                      changeQuantity(
                        p,
                        (cart.find(x=>x.id===p.id)?.qty || 0)-1
                      )
                    }>−</button>

                    <b>{cart.find(x=>x.id===p.id)?.qty}</b>

                    <button onClick={()=>
                      changeQuantity(
                        p,
                        (cart.find(x=>x.id===p.id)?.qty || 0)+1
                      )
                    }>+</button>
                  </div>
                }

                <div className="product-actions">
                  <button
                    className="add"
                    onClick={()=>
                      changeQuantity(
                        p,
                        (cart.find(x=>x.id===p.id)?.qty || 0)+1
                      )
                    }
                  >
                    + कार्ट में जोड़ें
                  </button>

                  <button
                    className="buy-now"
                    onClick={()=>buyNow(p)}
                  >
                    अभी खरीदें
                  </button>
                </div>
              </div>
            </article>
          )}
        </div>

        {!visibleProducts.length &&
          <p>इस खोज में कोई सामान नहीं मिला।</p>
        }
      </section>

      <section className="panel checkout-panel" id="checkout-panel">
        <h2>आपका कार्ट और ऑर्डर</h2>

        {!cart.length
          ? <p>कार्ट खाली है। ऊपर से सामान चुनें।</p>
          : cart.map(p =>
            <div className="bill-row" key={p.id}>
              <span>{p.name} × {p.qty}</span>
              <b>₹{Number(p.price)*p.qty}</b>
            </div>
          )
        }

        <div className="bill-row">
          <span>सामान का कुल</span>
          <b>₹{subtotal}</b>
        </div>

        <div className="bill-row">
          <span>डिलीवरी</span>
          <b>{delivery ? `₹${delivery}` : 'मुफ़्त'}</b>
        </div>

        <div className="bill-row grand-total">
          <span>कुल भुगतान</span>
          <b>₹{total}</b>
        </div>

        <h3>डिलीवरी की जानकारी</h3>

        <div className="form-grid">
          <input
            placeholder="आपका नाम"
            value={form.name}
            onChange={e=>setForm({...form,name:e.target.value})}
          />

          <input
            placeholder="10 अंकों का मोबाइल नंबर"
            value={form.mobile}
            onChange={e=>setForm({...form,mobile:e.target.value})}
          />

          <textarea
            placeholder="पूरा डिलीवरी पता (चिखली के आसपास)"
            value={form.address}
            onChange={e=>setForm({...form,address:e.target.value})}
          />

          <input
            placeholder="अतिरिक्त निर्देश (वैकल्पिक)"
            value={form.note}
            onChange={e=>setForm({...form,note:e.target.value})}
          />
        </div>

        <div className="payment-options">
          <label>
            <input
              type="radio"
              checked={form.payment==='COD'}
              onChange={()=>setForm({...form,payment:'COD'})}
            />
            Cash on Delivery
          </label>

          <label>
            <input
              type="radio"
              checked={form.payment==='UPI'}
              onChange={()=>setForm({...form,payment:'UPI'})}
            />
            UPI / PhonePe
          </label>
        </div>

        {form.payment==='UPI' &&
          <p className="upi-note">
            UPI ID: <b>{UPI_ID}</b>
            <br/>
            UPI भुगतान दुकान द्वारा अलग से Verify किया जाएगा।
            ऑर्डर देने से भुगतान अपने आप Confirm नहीं होगा।
          </p>
        }

        {message && <p className="notice">{message}</p>}

        <button
          className="place-order"
          onClick={checkout}
          disabled={submitting}
        >
          {submitting ? 'ऑर्डर सेव हो रहा है...' : 'वेबसाइट पर ऑर्डर करें'}
        </button>

        <small className="fine-print">
          ऑर्डर मिलने के बाद दुकान उपलब्धता और डिलीवरी की पुष्टि करेगी।
        </small>
      </section>
    </main>

    <footer>
      © Chetan Kirana • Chikhali, Maharashtra •
      <a
        href="https://maps.app.goo.gl/KkEmZYgXV6szxAiv8"
        target="_blank"
        rel="noreferrer"
      >
        दुकान का पता
      </a>
    </footer>
  </>;
}

function AdminPanel() {
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [session,setSession] = useState(null);
  const [products,setProducts] = useState([]);
  const [categories,setCategories] = useState([]);
  const [orders,setOrders] = useState([]);
  const [message,setMessage] = useState('');
  const [activeTab,setActiveTab] = useState('orders');
  const [loadingOrders,setLoadingOrders] = useState(false);
  const [searchOrder,setSearchOrder] = useState('');

  const [product,setProduct] = useState({
    name:'',
    category_id:'',
    price:'',
    stock:'0',
    description:''
  });

  const orderStatuses = [
    {value:'placed',label:'नया ऑर्डर'},
    {value:'confirmed',label:'Confirmed'},
    {value:'packed',label:'Packed'},
    {value:'out_for_delivery',label:'Out for Delivery'},
    {value:'delivered',label:'Delivered'},
    {value:'cancelled',label:'Cancelled'}
  ];

  function statusLabel(status) {
    return orderStatuses.find(s=>s.value===status)?.label || status;
  }

  useEffect(()=>{
    if (!supabase) return;

    supabase.auth.getSession().then(({data,error})=>{
      if (error) {
        setMessage(error.message);
        return;
      }

      setSession(data.session);

      if (data.session) {
        loadProducts();
        loadCategories();
        loadOrders();
      }
    });
  },[]);

  async function loadCategories() {
    const {data,error} = await supabase
      .from('categories')
      .select('id,name')
      .order('name');

    if (error) {
      setMessage('Category Error: '+error.message);
      return;
    }

    setCategories(data || []);

    if (data?.length) {
      setProduct(current=>({
        ...current,
        category_id:current.category_id || String(data[0].id)
      }));
    }
  }

  async function loadProducts() {
    const {data,error} = await supabase
      .from('products')
      .select(`
        id,
        name,
        price,
        stock,
        description,
        image_url,
        is_active,
        category_id,
        category:categories(name)
      `)
      .order('id',{ascending:false});

    if (error) {
      setMessage('Products Error: '+error.message);
      return;
    }

    setProducts(data || []);
  }

  async function loadOrders() {
    setLoadingOrders(true);

    const {data,error} = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          product_name,
          quantity,
          unit_price,
          line_total
        )
      `)
      .order('created_at',{ascending:false});

    setLoadingOrders(false);

    if (error) {
      console.error('Orders loading error:',error);
      setMessage('Orders Error: '+error.message);
      return;
    }

    setOrders(data || []);
  }

  async function updateOrderStatus(orderId,newStatus) {
    const {error} = await supabase
      .from('orders')
      .update({order_status:newStatus})
      .eq('id',orderId);

    if (error) {
      setMessage('Status Update Error: '+error.message);
      return;
    }

    setMessage('ऑर्डर स्टेटस अपडेट हो गया।');
    await loadOrders();
  }

  async function markPaymentReceived(orderId) {
    const confirmed = window.confirm(
      'क्या ग्राहक से भुगतान वास्तव में प्राप्त हो गया है?'
    );

    if (!confirmed) return;

    const {error} = await supabase
      .from('orders')
      .update({payment_status:'paid'})
      .eq('id',orderId);

    if (error) {
      setMessage('Payment Update Error: '+error.message);
      return;
    }

    setMessage('भुगतान Paid के रूप में अपडेट किया गया।');
    await loadOrders();
  }

  async function login(e) {
    e.preventDefault();

    if (!supabase) {
      return setMessage('Supabase URL और public anon key सेट नहीं हैं।');
    }

    const {data,error} = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      setMessage(error.message);
    } else {
      setSession(data.session);
      setMessage('Admin Login सफल हुआ।');
      loadProducts();
      loadCategories();
      loadOrders();
    }
  }

  async function saveProduct(e) {
    e.preventDefault();

    if (!product.category_id) {
      return setMessage('पहले Category चुनें।');
    }

    const {error} = await supabase
      .from('products')
      .insert({
        name:product.name.trim(),
        category_id:Number(product.category_id),
        price:Number(product.price),
        stock:Number(product.stock),
        description:product.description,
        is_active:true
      });

    if (error) {
      setMessage('Product Save Error: '+error.message);
      return;
    }

    setMessage('उत्पाद सफलतापूर्वक सेव हो गया।');

    setProduct({
      name:'',
      category_id:categories.length ? String(categories[0].id) : '',
      price:'',
      stock:'0',
      description:''
    });

    loadProducts();
  }

  async function uploadImage(e,p) {
    const file = e.target.files?.[0];
    if (!file) return;

    const path =
      `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g,'-')}`;

    const {error} = await supabase.storage
      .from('product-images')
      .upload(path,file);

    if (error) {
      return setMessage('Image Upload Error: '+error.message);
    }

    const {data} = supabase.storage
      .from('product-images')
      .getPublicUrl(path);

    const result = await supabase
      .from('products')
      .update({image_url:data.publicUrl})
      .eq('id',p.id);

    if (result.error) {
      setMessage(result.error.message);
    } else {
      setMessage('Product Image Upload हो गई।');
      loadProducts();
    }
  }

  async function toggleProduct(p) {
    const {error} = await supabase
      .from('products')
      .update({is_active:!p.is_active})
      .eq('id',p.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage('Product Status अपडेट हो गया।');
    loadProducts();
  }

  const filteredOrders = orders.filter(o=>{
    const term = searchOrder.trim().toLowerCase();

    if (!term) return true;

    return (
      String(o.order_number || '').toLowerCase().includes(term) ||
      String(o.customer_name || '').toLowerCase().includes(term) ||
      String(o.mobile || '').includes(term)
    );
  });

  if (!session) {
    return <main className="admin">
      <h1>Chetan Kirana Admin</h1>
      <p>केवल अधिकृत एडमिन लॉगिन करें।</p>

      <form onSubmit={login}>
        <input
          type="email"
          required
          placeholder="Admin email"
          value={email}
          onChange={e=>setEmail(e.target.value)}
        />

        <input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={e=>setPassword(e.target.value)}
        />

        <button className="place-order">Login</button>
      </form>

      {message && <p className="notice">{message}</p>}

      <a href="/">← दुकान पर वापस जाएँ</a>
    </main>;
  }

  return <main className="admin">

    <div className="section-heading">
      <h1>Chetan Kirana Admin</h1>

      <button onClick={async()=>{
        await supabase.auth.signOut();
        setSession(null);
      }}>
        Logout
      </button>
    </div>

    <div className="chips">
      <button
        className={activeTab==='orders'?'selected':''}
        onClick={()=>setActiveTab('orders')}
      >
        ऑर्डर ({orders.length})
      </button>

      <button
        className={activeTab==='products'?'selected':''}
        onClick={()=>setActiveTab('products')}
      >
        Products ({products.length})
      </button>
    </div>

    {message && <p className="notice">{message}</p>}

    {activeTab==='orders' && <>
      <div className="section-heading">
        <h2>सभी ऑर्डर</h2>

        <button onClick={loadOrders} disabled={loadingOrders}>
          {loadingOrders?'लोड हो रहा है...':'Refresh'}
        </button>
      </div>

      <input
        placeholder="Order ID, ग्राहक नाम या मोबाइल खोजें..."
        value={searchOrder}
        onChange={e=>setSearchOrder(e.target.value)}
      />

      <div className="bill-row">
        <b>कुल ऑर्डर</b>
        <b>{orders.length}</b>
      </div>

      {loadingOrders && <p>ऑर्डर लोड हो रहे हैं...</p>}

      {!loadingOrders && filteredOrders.length===0 &&
        <p>कोई ऑर्डर नहीं मिला।</p>
      }

      {filteredOrders.map(o=>
        <div
          className="panel"
          key={o.id}
          style={{marginBottom:'18px'}}
        >
          <div className="section-heading">
            <h3>{o.order_number}</h3>
            <b>₹{o.total}</b>
          </div>

          <p>
            <b>ग्राहक:</b> {o.customer_name}
          </p>

          <p>
            <b>मोबाइल:</b>{' '}
            <a href={`tel:${o.mobile}`}>{o.mobile}</a>
          </p>

          <p>
            <b>डिलीवरी पता:</b> {o.delivery_address}
          </p>

          {o.note && <p><b>निर्देश:</b> {o.note}</p>}

          <p>
            <b>ऑर्डर समय:</b>{' '}
            {o.created_at
              ? new Date(o.created_at).toLocaleString('en-IN')
              : 'उपलब्ध नहीं'}
          </p>

          <hr/>

          <h4>ऑर्डर के सामान</h4>

          {(o.order_items || []).map(item=>
            <div className="bill-row" key={item.id}>
              <span>
                {item.product_name} × {item.quantity}
              </span>
              <b>₹{item.line_total}</b>
            </div>
          )}

          <hr/>

          <div className="bill-row">
            <span>सामान का कुल</span>
            <b>₹{o.subtotal}</b>
          </div>

          <div className="bill-row">
            <span>डिलीवरी चार्ज</span>
            <b>₹{o.delivery_fee}</b>
          </div>

          <div className="bill-row grand-total">
            <span>कुल राशि</span>
            <b>₹{o.total}</b>
          </div>

          <p>
            <b>भुगतान तरीका:</b>{' '}
            {o.payment_method==='COD'?'Cash on Delivery':'UPI'}
          </p>

          <p>
            <b>भुगतान स्थिति:</b>{' '}
            {o.payment_status==='paid'?'Paid':'Pending'}
          </p>

          {o.payment_status!=='paid' &&
            <button
              onClick={()=>markPaymentReceived(o.id)}
            >
              भुगतान प्राप्त हुआ
            </button>
          }

          <hr/>

          <label>
            <b>ऑर्डर स्टेटस बदलें</b>
          </label>

          <select
            value={o.order_status}
            onChange={e=>updateOrderStatus(o.id,e.target.value)}
            style={{
              display:'block',
              width:'100%',
              padding:'12px',
              marginTop:'8px'
            }}
          >
            {orderStatuses.map(s=>
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            )}
          </select>

          <p>
            <b>वर्तमान स्थिति:</b> {statusLabel(o.order_status)}
          </p>
        </div>
      )}
    </>}

    {activeTab==='products' && <>
      <h2>नया उत्पाद जोड़ें</h2>

      <form onSubmit={saveProduct}>
        <input
          required
          placeholder="उत्पाद का नाम"
          value={product.name}
          onChange={e=>setProduct({...product,name:e.target.value})}
        />

        <select
          required
          value={product.category_id}
          onChange={e=>setProduct({...product,category_id:e.target.value})}
        >
          <option value="">Category चुनें</option>
          {categories.map(c=>
            <option key={c.id} value={c.id}>{c.name}</option>
          )}
        </select>

        <input
          required
          type="number"
          min="0"
          step="0.01"
          placeholder="कीमत ₹"
          value={product.price}
          onChange={e=>setProduct({...product,price:e.target.value})}
        />

        <input
          type="number"
          min="0"
          step="1"
          placeholder="Stock"
          value={product.stock}
          onChange={e=>setProduct({...product,stock:e.target.value})}
        />

        <textarea
          placeholder="छोटा विवरण"
          value={product.description}
          onChange={e=>setProduct({...product,description:e.target.value})}
        />

        <button
          className="place-order"
          disabled={!categories.length}
        >
          उत्पाद सेव करें
        </button>

        {!categories.length &&
          <p>पहले Categories Table में Category जोड़ें।</p>
        }
      </form>

      <h2>उत्पाद सूची ({products.length})</h2>

      {products.map(p=>
        <div className="admin-product" key={p.id}>
          <b>{p.name}</b>
          <span>₹{p.price}</span>
          <span>Stock: {p.stock}</span>
          <span>{p.category?.name || 'अन्य'}</span>

          <label>
            फोटो अपलोड
            <input
              type="file"
              accept="image/*"
              onChange={e=>uploadImage(e,p)}
            />
          </label>

          <button onClick={()=>toggleProduct(p)}>
            {p.is_active?'दुकान से हटाएँ':'फिर चालू करें'}
          </button>
        </div>
      )}
    </>}

    <a href="/">← दुकान पर वापस जाएँ</a>
  </main>;
}
