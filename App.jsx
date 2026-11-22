
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
  const [form, setForm] = useState({name:'',mobile:'',address:'',note:'',payment:'COD'});
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!supabase) return;

    supabase.from('products')
      .select('id,name,category,price,unit,description,image_url')
      .eq('is_active', true)
      .order('name')
      .then(({data,error}) => {
        if (error) {
          console.error(error);
          return;
        }

        const realProducts = data || [];
        const realNames = new Set(
          realProducts.map(p => p.name.trim().toLowerCase())
        );

        const remainingSamples = sampleProducts.filter(
          p => !realNames.has(p.name.trim().toLowerCase())
        );

        setProducts([...realProducts, ...remainingSamples]);
      });
  }, []);

  const categories = ['सभी', ...new Set(products.map(p => p.category).filter(Boolean))];

  const visibleProducts = products.filter(p =>
    (category === 'सभी' || p.category === category) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const subtotal = cart.reduce((sum,p) => sum + Number(p.price) * p.qty, 0);
  const delivery = subtotal === 0 || subtotal >= 500 ? 0 : 20;
  const total = subtotal + delivery;

  function changeQuantity(product, quantity) {
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
    const quantity = existing ? existing.qty : 1;

    changeQuantity(product, quantity);

    setTimeout(() => {
      document.getElementById('checkout-panel')?.scrollIntoView({
        behavior:'smooth',
        block:'start'
      });
    }, 100);
  }

  function makeOrderMessage() {
    return [
      'नमस्ते Chetan Kirana, मुझे यह ऑर्डर करना है:',
      ...cart.map(p => `${p.name} x ${p.qty} = ₹${Number(p.price)*p.qty}`),
      `सामान: ₹${subtotal}`,
      `डिलीवरी: ₹${delivery}`,
      `कुल: ₹${total}`,
      `नाम: ${form.name}`,
      `मोबाइल: ${form.mobile}`,
      `पता: ${form.address}`,
      `नोट: ${form.note}`,
      `पेमेंट: ${form.payment === 'COD' ? 'Cash on Delivery' : 'UPI'}`
    ].join('\n');
  }

  async function checkout() {
    setMessage('');

    if (!cart.length) {
      return setMessage('पहले कार्ट में सामान जोड़ें।');
    }

    if (!form.name.trim() || !form.mobile.trim() || !form.address.trim()) {
      return setMessage('कृपया नाम, मोबाइल नंबर और पूरा पता भरें।');
    }

    if (!/^[6-9][0-9]{9}$/.test(form.mobile)) {
      return setMessage('कृपया सही 10 अंकों का मोबाइल नंबर लिखें।');
    }

    const containsSample = cart.some(p => String(p.id).startsWith('sample-'));

    if (supabase && !containsSample) {
      const {error} = await supabase.rpc('create_customer_order', {
        p_customer_name: form.name.trim(),
        p_mobile: form.mobile,
        p_address: form.address.trim(),
        p_note: form.note,
        p_payment_method: form.payment,
        p_items: cart.map(p => ({
          product_id:p.id,
          quantity:p.qty
        }))
      });

      if (error) {
        setMessage('वेबसाइट पर ऑर्डर सेव नहीं हो पाया। WhatsApp से ऑर्डर भेजें।');
      } else {
        setMessage('ऑर्डर वेबसाइट पर सेव हुआ है। WhatsApp में भी विवरण भेजें।');
      }
    } else {
      setMessage('WhatsApp में ऑर्डर भेजकर दुकान से पुष्टि प्राप्त करें।');
    }

    window.open(
      `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(makeOrderMessage())}`,
      '_blank'
    );
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
      <a className="whatsapp" href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noreferrer">
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
                <small>{p.description||p.unit||''}</small>
                <strong>
                  ₹{p.price} <small>/{p.unit||'पीस'}</small>
                </strong>

                {cart.some(x=>x.id===p.id) &&
                  <div className="quantity">
                    <button onClick={()=>
                      changeQuantity(p,(cart.find(x=>x.id===p.id)?.qty||0)-1)
                    }>−</button>
                    <b>{cart.find(x=>x.id===p.id)?.qty}</b>
                    <button onClick={()=>
                      changeQuantity(p,(cart.find(x=>x.id===p.id)?.qty||0)+1)
                    }>+</button>
                  </div>
                }

                <div className="product-actions">
                  <button className="add" onClick={()=>changeQuantity(
                    p,(cart.find(x=>x.id===p.id)?.qty||0)+1
                  )}>
                    + कार्ट में जोड़ें
                  </button>

                  <button className="buy-now" onClick={()=>buyNow(p)}>
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
            UPI ID: <b>{UPI_ID}</b> — भुगतान के बाद WhatsApp पर पुष्टि भेजें।
          </p>
        }

        {message && <p className="notice">{message}</p>}

        <button className="place-order" onClick={checkout}>
          WhatsApp पर ऑर्डर भेजें
        </button>

        <small className="fine-print">
          ऑर्डर भेजने के बाद दुकान उपलब्धता और डिलीवरी की पुष्टि करेगी।
        </small>
      </section>
    </main>

    <footer>
      © Chetan Kirana • Chikhali, Maharashtra •
      <a href="https://maps.app.goo.gl/KkEmZYgXV6szxAiv8"> दुकान का पता</a>
    </footer>
  </>;
}

function AdminPanel() {
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [session,setSession]=useState(null);
  const [products,setProducts]=useState([]);
  const [message,setMessage]=useState('');
  const [product,setProduct]=useState({
    name:'',
    category:'किराना',
    price:'',
    unit:'किलो',
    description:''
  });

  useEffect(()=>{
    if(!supabase)return;
    supabase.auth.getSession().then(({data})=>{
      setSession(data.session);
      if(data.session)loadProducts();
    });
  },[]);

  async function loadProducts() {
    const {data,error}=await supabase
      .from('products')
      .select('*')
      .order('created_at',{ascending:false});

    if(error)setMessage(error.message);
    setProducts(data||[]);
  }

  async function login(e) {
    e.preventDefault();

    if(!supabase) {
      return setMessage('Supabase URL और public anon key अभी सेट नहीं हैं।');
    }

    const {data,error}=await supabase.auth.signInWithPassword({email,password});

    if(error)setMessage(error.message);
    else {
      setSession(data.session);
      loadProducts();
    }
  }

  async function saveProduct(e) {
    e.preventDefault();

    const {error}=await supabase.from('products').insert({
      ...product,
      price:Number(product.price),
      is_active:true
    });

    setMessage(error?error.message:'उत्पाद सेव हो गया।');

    if(!error) {
      setProduct({
        name:'',
        category:'किराना',
        price:'',
        unit:'किलो',
        description:''
      });
      loadProducts();
    }
  }

  async function uploadImage(e,p) {
    const file=e.target.files?.[0];
    if(!file)return;

    const path=`${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g,'-')}`;

    const {error}=await supabase.storage
      .from('product-images')
      .upload(path,file);

    if(error)return setMessage(error.message);

    const {data}=supabase.storage
      .from('product-images')
      .getPublicUrl(path);

    const result=await supabase
      .from('products')
      .update({image_url:data.publicUrl})
      .eq('id',p.id);

    if(result.error)setMessage(result.error.message);
    else loadProducts();
  }

  if(!session) {
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

      <p>{message}</p>
      <a href="/">← दुकान पर वापस जाएँ</a>
    </main>;
  }

  return <main className="admin">
    <div className="section-heading">
      <h1>Admin Panel</h1>
      <button onClick={async()=>{
        await supabase.auth.signOut();
        setSession(null);
      }}>
        Logout
      </button>
    </div>

    <h2>नया उत्पाद जोड़ें</h2>

    <form onSubmit={saveProduct}>
      <input
        required
        placeholder="उत्पाद का नाम"
        value={product.name}
        onChange={e=>setProduct({...product,name:e.target.value})}
      />
      <input
        required
        placeholder="श्रेणी"
        value={product.category}
        onChange={e=>setProduct({...product,category:e.target.value})}
      />
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
        placeholder="इकाई (किलो/पैक/पीस)"
        value={product.unit}
        onChange={e=>setProduct({...product,unit:e.target.value})}
      />
      <input
        placeholder="छोटा विवरण"
        value={product.description}
        onChange={e=>setProduct({...product,description:e.target.value})}
      />
      <button className="place-order">उत्पाद सेव करें</button>
    </form>

    {message && <p className="notice">{message}</p>}

    <h2>उत्पाद सूची</h2>

    {products.map(p=>
      <div className="admin-product" key={p.id}>
        <b>{p.name}</b>
        <span>₹{p.price}</span>

        <label>
          फोटो अपलोड
          <input
            type="file"
            accept="image/*"
            onChange={e=>uploadImage(e,p)}
          />
        </label>

        <button onClick={async()=>{
          const {error}=await supabase
            .from('products')
            .update({is_active:!p.is_active})
            .eq('id',p.id);

          if(error)setMessage(error.message);
          loadProducts();
        }}>
          {p.is_active?'दुकान से हटाएँ':'फिर चालू करें'}
        </button>
      </div>
    )}

    <a href="/">← दुकान पर वापस जाएँ</a>
  </main>;
}
