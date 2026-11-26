
import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';

const WHATSAPP = '919307451094';
const UPI_ID = 'Q801760632@ybl';
const UPI_NAME = 'Chetan Kirana';

const sampleProducts = [
  {id:'sample-1',name:'अंडे (6 पीस)',category:'डेयरी एवं अंडे',price:48,unit:'पैक',description:'ताज़े अंडे'},
  {id:'sample-2',name:'चीनी',category:'किराना',price:48,unit:'किलो',description:'दैनिक उपयोग की चीनी'},
  {id:'sample-3',name:'तूर दाल',category:'दालें',price:145,unit:'किलो',description:'साफ-सुथरी तूर दाल'},
  {id:'sample-4',name:'चावल',category:'चावल',price:60,unit:'किलो',description:'रोज़ाना उपयोग के लिए'}
];

const trackingSteps = [
  {value:'placed',label:'ऑर्डर प्राप्त हुआ',icon:'🛒'},
  {value:'confirmed',label:'ऑर्डर Confirmed',icon:'✅'},
  {value:'packed',label:'सामान पैक हो गया',icon:'📦'},
  {value:'out_for_delivery',label:'डिलीवरी के लिए निकल गया',icon:'🚚'},
  {value:'delivered',label:'ऑर्डर Delivered',icon:'🎉'}
];

const orderStatuses = [
  {value:'placed',label:'नया ऑर्डर'},
  {value:'confirmed',label:'Confirmed'},
  {value:'packed',label:'Packed'},
  {value:'out_for_delivery',label:'Out for Delivery'},
  {value:'delivered',label:'Delivered'},
  {value:'cancelled',label:'Cancelled'}
];

function localDateKey(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function todayKey() {
  return localDateKey(new Date());
}

function money(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN',{maximumFractionDigits:2})}`;
}

export default function App() {
  if (window.location.pathname === '/admin') return <AdminPanel />;
  if (window.location.pathname === '/delivery') return <DeliveryPartnerPanel />;
  return <Storefront />;
}

function Storefront() {
  const [products,setProducts] = useState(sampleProducts);
  const [cart,setCart] = useState([]);
  const [search,setSearch] = useState('');
  const [category,setCategory] = useState('सभी');
  const [form,setForm] = useState({name:'',mobile:'',address:'',note:'',payment:'COD'});
  const [message,setMessage] = useState('');
  const [submitting,setSubmitting] = useState(false);
  const [lastUpiOrder,setLastUpiOrder] = useState(null);
  const [utr,setUtr] = useState('');
  const [utrSubmitting,setUtrSubmitting] = useState(false);
  const [trackingOrderId,setTrackingOrderId] = useState('');
  const [trackingMobile,setTrackingMobile] = useState('');
  const [trackingOrder,setTrackingOrder] = useState(null);
  const [trackingMessage,setTrackingMessage] = useState('');
  const [trackingLoading,setTrackingLoading] = useState(false);
  const [trackingUtr,setTrackingUtr] = useState('');
  const [trackingUtrSubmitting,setTrackingUtrSubmitting] = useState(false);

  useEffect(()=>{ loadProducts(); },[]);

  async function loadProducts() {
    if (!supabase) return;
    const {data,error} = await supabase.from('products')
      .select('id,name,category_id,price,description,image_url,stock,is_active,category:categories(name)')
      .eq('is_active',true).order('name');
    if (error) {
      console.error(error);
      setMessage('उत्पाद लोड नहीं हो पाए। कृपया Refresh करें।');
      return;
    }
    const realProducts = (data || []).map(p=>({...p,category:p.category?.name || 'अन्य',unit:'पीस'}));
    const realNames = new Set(realProducts.map(p=>p.name.trim().toLowerCase()));
    setProducts([...realProducts,...sampleProducts.filter(p=>!realNames.has(p.name.trim().toLowerCase()))]);
  }

  const categories = ['सभी',...new Set(products.map(p=>p.category).filter(Boolean))];
  const visibleProducts = products.filter(p=>
    (category==='सभी' || p.category===category) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  );
  const subtotal = cart.reduce((sum,p)=>sum+Number(p.price)*p.qty,0);
  const delivery = subtotal===0 || subtotal>=800 ? 0 : 30;
  const total = subtotal+delivery;

  function changeQuantity(product,quantity) {
    setCart(current=>{
      const existing = current.find(p=>p.id===product.id);
      if (quantity<=0) return current.filter(p=>p.id!==product.id);
      if (existing) return current.map(p=>p.id===product.id?{...p,qty:quantity}:p);
      return [...current,{...product,qty:quantity}];
    });
  }

  function buyNow(product) {
    const existing = cart.find(p=>p.id===product.id);
    changeQuantity(product,existing?existing.qty:1);
    setTimeout(()=>document.getElementById('checkout-panel')?.scrollIntoView({behavior:'smooth',block:'start'}),100);
  }

  async function checkout() {
    setMessage('');
    if (!cart.length) return setMessage('पहले कार्ट में सामान जोड़ें।');
    if (!form.name.trim() || !form.mobile.trim() || !form.address.trim())
      return setMessage('कृपया नाम, मोबाइल नंबर और पूरा पता भरें।');
    if (!/^[6-9][0-9]{9}$/.test(form.mobile.trim()))
      return setMessage('कृपया सही 10 अंकों का मोबाइल नंबर लिखें।');
    if (!supabase) return setMessage('Database कनेक्शन उपलब्ध नहीं है।');
    if (cart.some(p=>String(p.id).startsWith('sample-')))
      return setMessage('कार्ट में Demo Product है। कृपया केवल असली Products चुनें।');

    setSubmitting(true);
    try {
      const {data,error} = await supabase.rpc('create_customer_order',{
        p_customer_name:form.name.trim(),
        p_mobile:form.mobile.trim(),
        p_address:form.address.trim(),
        p_note:form.note.trim(),
        p_payment_method:form.payment,
        p_items:cart.map(p=>({product_id:Number(p.id),quantity:p.qty}))
      });
      if (error) {
        console.error(error);
        setMessage('ऑर्डर सेव नहीं हुआ। कृपया दोबारा कोशिश करें।');
        return;
      }
      if (!data?.success || !data?.order_number) {
        setMessage('ऑर्डर की पुष्टि नहीं हो सकी। दुकान से संपर्क करें।');
        return;
      }
      setCart([]);
      if (form.payment==='UPI') {
        setLastUpiOrder({orderNumber:data.order_number,mobile:form.mobile.trim(),total:Number(data.total)});
        setUtr('');
      } else setLastUpiOrder(null);
      setTrackingOrderId(data.order_number);
      setTrackingMobile(form.mobile.trim());
      setMessage(`🎉 आपका ऑर्डर सेव हो गया! Order ID: ${data.order_number} | कुल राशि: ₹${data.total} | भुगतान: ${form.payment==='COD'?'Cash on Delivery':'UPI - भुगतान सत्यापन बाकी'}`);
    } catch (error) {
      console.error(error);
      setMessage('कुछ तकनीकी समस्या आई। कृपया दोबारा कोशिश करें।');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitUpiReference() {
    if (!lastUpiOrder) return setMessage('ऑर्डर की जानकारी उपलब्ध नहीं है।');
    const reference = utr.trim();
    if (reference.length<6 || reference.length>50) return setMessage('कृपया सही Transaction ID दर्ज करें।');
    setUtrSubmitting(true);
    setMessage('');
    try {
      const {data,error} = await supabase.rpc('submit_upi_reference',{
        p_order_number:lastUpiOrder.orderNumber,
        p_mobile:lastUpiOrder.mobile,
        p_reference:reference
      });
      if (error) {
        setMessage('UTR Submit Error: '+error.message);
        return;
      }
      if (!data?.success) {
        setMessage(data?.message || 'UTR जमा नहीं हुआ।');
        return;
      }
      setMessage('आपका UTR जमा हो गया। भुगतान दुकान द्वारा Verify किया जाएगा।');
      setLastUpiOrder(null);
      setUtr('');
    } catch (error) {
      console.error(error);
      setMessage('UTR जमा करते समय समस्या आई।');
    } finally {
      setUtrSubmitting(false);
    }
  }

  async function trackCustomerOrder() {
    setTrackingMessage('');
    setTrackingOrder(null);
    if (!trackingOrderId.trim() || !trackingMobile.trim())
      return setTrackingMessage('कृपया Order ID और मोबाइल नंबर भरें।');
    if (!/^[6-9][0-9]{9}$/.test(trackingMobile.trim()))
      return setTrackingMessage('कृपया सही 10 अंकों का मोबाइल नंबर लिखें।');
    if (!supabase) return setTrackingMessage('Database कनेक्शन उपलब्ध नहीं है।');

    setTrackingLoading(true);
    try {
      const {data,error} = await supabase.rpc('track_customer_order',{
        p_order_number:trackingOrderId.trim(),
        p_mobile:trackingMobile.trim()
      });
      if (error) {
        setTrackingMessage('Tracking Error: '+error.message);
        return;
      }
      if (!data?.success || !data?.order) {
        setTrackingMessage(data?.message || 'ऑर्डर नहीं मिला। Order ID और मोबाइल जाँचें।');
        return;
      }
      setTrackingOrder(data.order);
      setTrackingUtr('');
    } catch (error) {
      console.error(error);
      setTrackingMessage('तकनीकी समस्या आई। कृपया दोबारा कोशिश करें।');
    } finally {
      setTrackingLoading(false);
    }
  }

  async function submitTrackingUtr() {
    if (!trackingOrder) return;
    const reference = trackingUtr.trim();
    if (reference.length<6 || reference.length>50) return setTrackingMessage('कृपया सही Transaction ID दर्ज करें।');
    setTrackingUtrSubmitting(true);
    setTrackingMessage('');
    try {
      const {data,error} = await supabase.rpc('submit_upi_reference',{
        p_order_number:trackingOrder.order_number,
        p_mobile:trackingMobile.trim(),
        p_reference:reference
      });
      if (error) {
        setTrackingMessage('UTR Error: '+error.message);
        return;
      }
      if (!data?.success) {
        setTrackingMessage(data?.message || 'UTR जमा नहीं हुआ।');
        return;
      }
      setTrackingUtr('');
      await trackCustomerOrder();
      setTrackingMessage('UTR जमा हो गया। दुकान भुगतान की जाँच करेगी।');
    } catch (error) {
      console.error(error);
      setTrackingMessage('UTR जमा करते समय समस्या आई।');
    } finally {
      setTrackingUtrSubmitting(false);
    }
  }

  function trackingStatusLabel(status) {
    return orderStatuses.find(s=>s.value===status)?.label || status;
  }

  const upiLink = lastUpiOrder
    ? `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(UPI_NAME)}&am=${encodeURIComponent(lastUpiOrder.total.toFixed(2))}&cu=INR&tn=${encodeURIComponent(lastUpiOrder.orderNumber)}`
    : '';

  return <>
    <header>
      <div className="brand">
        <div className="logo"><span>CK</span><i>🛒</i></div>
        <div><h1>Chetan Kirana</h1><small>आपकी अपनी ऑनलाइन किराना दुकान</small></div>
      </div>
      <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
        <a className="whatsapp" href="#tracking-panel" style={{textDecoration:'none'}}>Track Order</a>
        <a className="whatsapp" href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noreferrer">WhatsApp</a>
      </div>
    </header>

    <main>
      <section className="hero">
        <div>
          <span className="tag">CHIKHALI • 5 KM DELIVERY</span>
          <h2>रोज़मर्रा का सामान,<br/>अब घर बैठे मंगाएँ!</h2>
          <p>आसान ऑर्डर • भरोसेमंद सेवा • घर तक डिलीवरी</p>
        </div>
        <div className="hero-icon">🛒</div>
      </section>

      <p className="notice">₹800 या उससे अधिक की खरीदारी पर डिलीवरी मुफ़्त। ₹800 से कम पर ₹30 डिलीवरी चार्ज।</p>

      <section className="panel" style={{marginTop:'14px'}}>
        <h2>📍 हमारी डिलीवरी सेवा</h2>
        <p><b>Chikhali और आसपास के गाँवों में 5 KM तक घरपोच डिलीवरी।</b></p>
        <p>Mankopra • Barbadi • Sangalwadi • Kolwai • Manki • Borgaon • Pimpalgaon • Bhandegaon</p>
        <p className="fine-print">डिलीवरी की उपलब्धता आपके पूरे पते और सड़क मार्ग के अनुसार जाँची जाएगी।</p>
      </section>

      <section className="panel">
        <div className="section-heading"><h2>सामान चुनें</h2><span>{products.length} उत्पाद</span></div>
        <input className="search" placeholder="सामान खोजें..." value={search} onChange={e=>setSearch(e.target.value)}/>
        <div className="chips">
          {categories.map(c=><button key={c} className={category===c?'selected':''} onClick={()=>setCategory(c)}>{c}</button>)}
        </div>
        <div className="products">
          {visibleProducts.map(p=><article className="product" key={p.id}>
            <div className="product-image">{p.image_url?<img src={p.image_url} alt={p.name}/>:<span>🛍️</span>}</div>
            <div className="product-info">
              <b>{p.name}</b><small>{p.description || p.unit || ''}</small>
              <strong>₹{p.price} <small>/{p.unit || 'पीस'}</small></strong>
              {cart.some(x=>x.id===p.id) && <div className="quantity">
                <button onClick={()=>changeQuantity(p,(cart.find(x=>x.id===p.id)?.qty || 0)-1)}>−</button>
                <b>{cart.find(x=>x.id===p.id)?.qty}</b>
                <button onClick={()=>changeQuantity(p,(cart.find(x=>x.id===p.id)?.qty || 0)+1)}>+</button>
              </div>}
              <div className="product-actions">
                <button className="add" onClick={()=>changeQuantity(p,(cart.find(x=>x.id===p.id)?.qty || 0)+1)}>+ कार्ट में जोड़ें</button>
                <button className="buy-now" onClick={()=>buyNow(p)}>अभी खरीदें</button>
              </div>
            </div>
          </article>)}
        </div>
        {!visibleProducts.length && <p>इस खोज में कोई सामान नहीं मिला।</p>}
      </section>

      <section className="panel" id="tracking-panel">
        <h2>📦 Track Your Order</h2>
        <p>Order ID और ऑर्डर में दिया गया मोबाइल नंबर भरें।</p>
        <div className="form-grid">
          <input placeholder="Order ID (जैसे CK-...)" value={trackingOrderId} onChange={e=>setTrackingOrderId(e.target.value)}/>
          <input placeholder="10 अंकों का मोबाइल नंबर" value={trackingMobile} onChange={e=>setTrackingMobile(e.target.value)} inputMode="numeric" maxLength={10}/>
        </div>
        <button className="place-order" onClick={trackCustomerOrder} disabled={trackingLoading}>{trackingLoading?'ऑर्डर खोज रहे हैं...':'ऑर्डर ट्रैक करें'}</button>
        {trackingMessage && <p className="notice">{trackingMessage}</p>}

        {trackingOrder && <div className="panel" style={{marginTop:'16px'}}>
          <h3>आपके ऑर्डर की जानकारी</h3>
          <p><b>Order ID:</b> {trackingOrder.order_number}</p>
          <p><b>ग्राहक:</b> {trackingOrder.customer_name}</p>
          <p><b>ऑर्डर समय:</b> {trackingOrder.created_at?new Date(trackingOrder.created_at).toLocaleString('en-IN'):'उपलब्ध नहीं'}</p>

          <div style={{margin:'16px 0',padding:'16px',border:'1px solid #cbd5e1',borderRadius:'12px',background:'#f8fafc'}}>
            <h4 style={{marginTop:0}}>🛵 Delivery Partner</h4>
            {trackingOrder.delivery_partner?.name ? <>
              <p><b>Delivery Boy:</b> {trackingOrder.delivery_partner.name}</p>
              <p><b>मोबाइल:</b> {trackingOrder.delivery_partner.mobile}</p>
              <a href={`tel:${trackingOrder.delivery_partner.mobile}`} className="place-order" style={{display:'block',textAlign:'center',textDecoration:'none',marginTop:'10px'}}>📞 Delivery Boy को Call करें</a>
            </> : <p className="fine-print">अभी आपके ऑर्डर के लिए Delivery Boy Assign नहीं किया गया है। Assign होने के बाद यहाँ जानकारी दिखाई देगी।</p>}
          </div>

          <div style={{margin:'20px 0',padding:'16px',border:'1px solid #ddd',borderRadius:'12px',background:'#fff'}}>
            <h4 style={{marginTop:0}}>📍 Order Progress</h4>
            {trackingOrder.order_status==='cancelled' ? <div style={{padding:'14px',borderRadius:'8px',background:'#fee2e2',color:'#b91c1c',fontWeight:'bold'}}>❌ आपका ऑर्डर Cancelled है।</div> :
              trackingSteps.map((step,index)=>{
                const currentIndex = trackingSteps.findIndex(item=>item.value===trackingOrder.order_status);
                const completed = currentIndex>=0 && index<=currentIndex;
                const current = index===currentIndex;
                return <div key={step.value} style={{display:'flex',alignItems:'center',gap:'12px',padding:'12px 0',borderBottom:index!==trackingSteps.length-1?'1px solid #eee':'none'}}>
                  <div style={{width:'40px',height:'40px',minWidth:'40px',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',background:completed?'#dcfce7':'#f1f5f9',border:current?'2px solid #16a34a':'1px solid #ddd',fontSize:'19px'}}>{completed?step.icon:'○'}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:completed?'bold':'normal',color:completed?'#15803d':'#64748b'}}>{step.label}</div>
                    {current && <div style={{fontSize:'12px',color:'#15803d',fontWeight:'bold',marginTop:'3px'}}>वर्तमान स्थिति</div>}
                  </div>
                  {completed && <span style={{color:'#15803d',fontSize:'20px',fontWeight:'bold'}}>✓</span>}
                </div>;
              })}
          </div>

          <p><b>वर्तमान ऑर्डर स्थिति:</b> {trackingStatusLabel(trackingOrder.order_status)}</p>
          <p><b>भुगतान तरीका:</b> {trackingOrder.payment_method==='COD'?'Cash on Delivery':'UPI'}</p>
          <p><b>भुगतान स्थिति:</b> {trackingOrder.payment_status==='paid'?'Paid':'Pending'}</p>
          <h4>सामान की सूची</h4>
          {(trackingOrder.items || []).map((item,index)=><div className="bill-row" key={index}><span>{item.product_name} × {item.quantity}</span><b>₹{item.line_total}</b></div>)}
          <hr/>
          <div className="bill-row"><span>सामान का कुल</span><b>₹{trackingOrder.subtotal}</b></div>
          <div className="bill-row"><span>डिलीवरी</span><b>₹{trackingOrder.delivery_fee}</b></div>
          <div className="bill-row grand-total"><span>कुल भुगतान</span><b>₹{trackingOrder.total}</b></div>

          {trackingOrder.payment_method==='UPI' && trackingOrder.payment_status!=='paid' && <div className="panel" style={{marginTop:'12px'}}>
            <h4>UPI Transaction Reference</h4>
            {trackingOrder.payment_reference ? <>
              <p><b>जमा किया गया UTR:</b><br/>{trackingOrder.payment_reference}</p>
              <p className="fine-print">आपका UTR जमा है। भुगतान की जाँच दुकान द्वारा बाकी है।</p>
            </> : <>
              <p>भुगतान करने के बाद UPI ऐप की Transaction Details से UTR यहाँ जमा करें।</p>
              <input placeholder="UTR / Transaction ID" value={trackingUtr} onChange={e=>setTrackingUtr(e.target.value)} maxLength={50}/>
              <button className="place-order" style={{marginTop:'10px'}} onClick={submitTrackingUtr} disabled={trackingUtrSubmitting}>{trackingUtrSubmitting?'जमा हो रहा है...':'UTR जमा करें'}</button>
            </>}
          </div>}
        </div>}
      </section>

      <section className="panel checkout-panel" id="checkout-panel">
        <h2>आपका कार्ट और ऑर्डर</h2>
        {!cart.length?<p>कार्ट खाली है। ऊपर से सामान चुनें।</p>:cart.map(p=><div className="bill-row" key={p.id}><span>{p.name} × {p.qty}</span><b>₹{Number(p.price)*p.qty}</b></div>)}
        <div className="bill-row"><span>सामान का कुल</span><b>₹{subtotal}</b></div>
        <div className="bill-row"><span>डिलीवरी</span><b>{delivery?`₹${delivery}`:'मुफ़्त'}</b></div>
        <div className="bill-row grand-total"><span>कुल भुगतान</span><b>₹{total}</b></div>
        <h3>डिलीवरी की जानकारी</h3>
        <div className="form-grid">
          <input placeholder="आपका नाम" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
          <input placeholder="10 अंकों का मोबाइल नंबर" value={form.mobile} onChange={e=>setForm({...form,mobile:e.target.value})} inputMode="numeric" maxLength={10}/>
          <textarea placeholder="पूरा पता और गाँव का नाम लिखें" value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/>
          <input placeholder="अतिरिक्त निर्देश (वैकल्पिक)" value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/>
        </div>
        <div className="payment-options">
          <label><input type="radio" checked={form.payment==='COD'} onChange={()=>setForm({...form,payment:'COD'})}/> Cash on Delivery</label>
          <label><input type="radio" checked={form.payment==='UPI'} onChange={()=>setForm({...form,payment:'UPI'})}/> UPI / PhonePe</label>
        </div>
        {form.payment==='UPI' && <p className="upi-note">UPI ID: <b>{UPI_ID}</b><br/>ऑर्डर देने के बाद UPI भुगतान करें और अपना UTR जमा करें। भुगतान दुकान द्वारा जाँचने के बाद ही Confirm होगा।</p>}
        {message && <p className="notice">{message}</p>}
        {lastUpiOrder && <div className="panel" style={{marginTop:'16px'}}>
          <h3>UPI भुगतान पूरा करें</h3>
          <p><b>Order ID:</b> {lastUpiOrder.orderNumber}</p>
          <p><b>भुगतान राशि:</b> ₹{lastUpiOrder.total.toFixed(2)}</p>
          <p><b>UPI ID:</b> {UPI_ID}</p>
          <a href={upiLink} className="place-order" style={{display:'block',textAlign:'center',textDecoration:'none',marginBottom:'12px'}}>PhonePe / UPI ऐप से भुगतान करें</a>
          <p className="fine-print">भुगतान करने के बाद UPI ऐप में Transaction Details खोलें और UTR / Transaction ID यहाँ भरें।</p>
          <input placeholder="UTR / Transaction ID" value={utr} onChange={e=>setUtr(e.target.value)} maxLength={50}/>
          <button className="place-order" onClick={submitUpiReference} disabled={utrSubmitting} style={{marginTop:'10px'}}>{utrSubmitting?'UTR जमा हो रहा है...':'UTR जमा करें'}</button>
          <p className="fine-print">UTR जमा करना भुगतान का प्रमाण नहीं है। दुकान भुगतान की जाँच करेगी।</p>
        </div>}
        <button className="place-order" onClick={checkout} disabled={submitting}>{submitting?'ऑर्डर सेव हो रहा है...':'वेबसाइट पर ऑर्डर करें'}</button>
        <small className="fine-print">ऑर्डर मिलने के बाद दुकान उपलब्धता और डिलीवरी की पुष्टि करेगी।</small>
      </section>
    </main>

    <footer>© Chetan Kirana • Chikhali, Maharashtra • <a href="https://maps.app.goo.gl/KkEmZYgXV6szxAiv8" target="_blank" rel="noreferrer">दुकान का पता</a> {' • '}<a href="#tracking-panel">Track Order</a></footer>
  </>;
}

function AdminPanel() {
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [session,setSession] = useState(null);
  const [products,setProducts] = useState([]);
  const [categories,setCategories] = useState([]);
  const [orders,setOrders] = useState([]);
  const [deliveryPartners,setDeliveryPartners] = useState([]);
  const [message,setMessage] = useState('');
  const [activeTab,setActiveTab] = useState('orders');
  const [loadingOrders,setLoadingOrders] = useState(false);
  const [searchOrder,setSearchOrder] = useState('');
  const [reportDate,setReportDate] = useState(todayKey());
  const [reportLoading,setReportLoading] = useState(false);

  const [product,setProduct] = useState({name:'',category_id:'',price:'',stock:'0',description:''});
  const [newPartner,setNewPartner] = useState({name:'',mobile:'',pin:''});
  const [partnerPinInputs,setPartnerPinInputs] = useState({});
  const [savingPartner,setSavingPartner] = useState(false);
  const [savingPartnerPin,setSavingPartnerPin] = useState(null);

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
        loadDeliveryPartners();
      }
    });
  },[]);

  async function loadCategories() {
    const {data,error} = await supabase.from('categories').select('id,name').order('name');
    if (error) {
      setMessage('Category Error: '+error.message);
      return;
    }
    setCategories(data || []);
    if (data?.length) setProduct(current=>({...current,category_id:current.category_id || String(data[0].id)}));
  }

  async function loadProducts() {
    const {data,error} = await supabase.from('products')
      .select('id,name,price,stock,description,image_url,is_active,category_id,category:categories(name)')
      .order('id',{ascending:false});
    if (error) {
      setMessage('Products Error: '+error.message);
      return;
    }
    setProducts(data || []);
  }

  async function loadOrders() {
    setLoadingOrders(true);
    const {data,error} = await supabase.from('orders')
      .select('*,order_items(id,product_name,quantity,unit_price,line_total)')
      .order('created_at',{ascending:false});
    setLoadingOrders(false);
    if (error) {
      console.error(error);
      setMessage('Orders Error: '+error.message);
      return;
    }
    setOrders(data || []);
  }

  async function loadDeliveryPartners() {
    const {data,error} = await supabase.from('delivery_partners')
      .select('id,name,mobile,is_active,created_at').order('name');
    if (error) {
      console.error(error);
      setMessage('Delivery Partner Error: '+error.message);
      return;
    }
    setDeliveryPartners(data || []);
  }

  async function addDeliveryPartner(e) {
    e.preventDefault();
    const name = newPartner.name.trim();
    const mobile = newPartner.mobile.trim();
    const pin = newPartner.pin.trim();
    if (!name) return setMessage('Delivery Boy का नाम भरें।');
    if (!/^[6-9][0-9]{9}$/.test(mobile)) return setMessage('सही 10 अंकों का मोबाइल नंबर दर्ज करें।');
    if (!/^[0-9]{6}$/.test(pin)) return setMessage('PIN ठीक 6 अंकों का होना चाहिए।');

    setSavingPartner(true);
    setMessage('');
    try {
      const {data:partner,error} = await supabase.from('delivery_partners')
        .insert({name,mobile,is_active:true}).select('id').single();
      if (error) {
        setMessage('Delivery Boy Save Error: '+error.message);
        return;
      }
      const {data:pinResult,error:pinError} = await supabase.rpc('admin_set_delivery_pin',{p_partner_id:partner.id,p_pin:pin});
      if (pinError || !pinResult?.success) {
        setMessage('Delivery Boy जुड़ गया, लेकिन PIN सेट नहीं हुआ। कृपया नीचे Reset PIN से PIN सेट करें। '+(pinError?.message || pinResult?.message || ''));
        setNewPartner({name:'',mobile:'',pin:''});
        await loadDeliveryPartners();
        return;
      }
      setNewPartner({name:'',mobile:'',pin:''});
      setMessage('Delivery Boy सफलतापूर्वक जोड़ दिया गया और PIN सेट हो गया।');
      await loadDeliveryPartners();
    } finally {
      setSavingPartner(false);
    }
  }

  async function setDeliveryPartnerPin(partnerId) {
    const pin = String(partnerPinInputs[partnerId] || '').trim();
    if (!/^[0-9]{6}$/.test(pin)) {
      setMessage('नया PIN ठीक 6 अंकों का होना चाहिए।');
      return;
    }
    setSavingPartnerPin(partnerId);
    setMessage('');
    try {
      const {data,error} = await supabase.rpc('admin_set_delivery_pin',{p_partner_id:partnerId,p_pin:pin});
      if (error) {
        setMessage('PIN Update Error: '+error.message);
        return;
      }
      if (!data?.success) {
        setMessage(data?.message || 'PIN सेट नहीं हुआ।');
        return;
      }
      setPartnerPinInputs(current=>({...current,[partnerId]:''}));
      setMessage('Delivery Boy का PIN सफलतापूर्वक सेट/Reset हो गया। पुराने Login Session बंद कर दिए गए हैं।');
    } finally {
      setSavingPartnerPin(null);
    }
  }

  async function toggleDeliveryPartner(partner) {
    const {error} = await supabase.from('delivery_partners').update({is_active:!partner.is_active}).eq('id',partner.id);
    if (error) {
      setMessage('Delivery Boy Status Error: '+error.message);
      return;
    }
    setMessage('Delivery Boy का Status अपडेट हो गया।');
    await loadDeliveryPartners();
  }

  async function assignDeliveryPartner(orderId,partnerId) {
    const selectedId = partnerId?Number(partnerId):null;
    const {error} = await supabase.from('orders').update({delivery_partner_id:selectedId}).eq('id',orderId);
    if (error) {
      setMessage('Delivery Assignment Error: '+error.message);
      return;
    }
    setMessage(selectedId?'Delivery Boy ऑर्डर पर Assign हो गया।':'ऑर्डर से Delivery Boy हटाया गया।');
    await loadOrders();
  }

  async function updateOrderStatus(orderId,newStatus) {
    const {error} = await supabase.from('orders').update({order_status:newStatus}).eq('id',orderId);
    if (error) {
      setMessage('Status Update Error: '+error.message);
      return;
    }
    setMessage('ऑर्डर स्टेटस अपडेट हो गया।');
    await loadOrders();
  }

  async function markPaymentReceived(orderId) {
    const order = orders.find(o=>o.id===orderId);
    const confirmed = window.confirm(`क्या आपने इस ऑर्डर ${order?.order_number || ''} का भुगतान अपने बैंक/PhonePe में वास्तव में प्राप्त होते हुए जाँच लिया है?`);
    if (!confirmed) return;
    const {error} = await supabase.from('orders').update({payment_status:'paid'}).eq('id',orderId);
    if (error) {
      setMessage('Payment Update Error: '+error.message);
      return;
    }
    setMessage('भुगतान Paid के रूप में अपडेट किया गया।');
    await loadOrders();
  }

  async function login(e) {
    e.preventDefault();
    if (!supabase) return setMessage('Supabase URL और public anon key सेट नहीं हैं।');
    const {data,error} = await supabase.auth.signInWithPassword({email,password});
    if (error) setMessage(error.message);
    else {
      setSession(data.session);
      setMessage('Admin Login सफल हुआ।');
      loadProducts();
      loadCategories();
      loadOrders();
      loadDeliveryPartners();
    }
  }

  async function saveProduct(e) {
    e.preventDefault();
    if (!product.category_id) return setMessage('पहले Category चुनें।');
    const {error} = await supabase.from('products').insert({
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
    setProduct({name:'',category_id:categories.length?String(categories[0].id):'',price:'',stock:'0',description:''});
    loadProducts();
  }

  async function uploadImage(e,p) {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g,'-')}`;
    const {error} = await supabase.storage.from('product-images').upload(path,file);
    if (error) return setMessage('Image Upload Error: '+error.message);
    const {data} = supabase.storage.from('product-images').getPublicUrl(path);
    const result = await supabase.from('products').update({image_url:data.publicUrl}).eq('id',p.id);
    if (result.error) setMessage(result.error.message);
    else {
      setMessage('Product Image Upload हो गई।');
      loadProducts();
    }
  }

  async function toggleProduct(p) {
    const {error} = await supabase.from('products').update({is_active:!p.is_active}).eq('id',p.id);
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
    return String(o.order_number || '').toLowerCase().includes(term) ||
      String(o.customer_name || '').toLowerCase().includes(term) ||
      String(o.mobile || '').includes(term) ||
      String(o.payment_reference || '').toLowerCase().includes(term);
  });

  // Delivery report: assigned/created date and actual delivered date are counted separately.
  const assignedOnDate = orders.filter(o=>
    o.delivery_partner_id && localDateKey(o.created_at)===reportDate
  );
  const deliveredOnDate = orders.filter(o=>
    o.delivery_partner_id && o.order_status==='delivered' && localDateKey(o.delivered_at)===reportDate
  );
  const pendingOnDate = assignedOnDate.filter(o=>
    !['delivered','cancelled'].includes(o.order_status)
  );
  const deliveredTotal = deliveredOnDate.reduce((sum,o)=>sum+Number(o.total || 0),0);
  const paidOrders = deliveredOnDate.filter(o=>o.payment_status==='paid');
  const paidTotal = paidOrders.reduce((sum,o)=>sum+Number(o.total || 0),0);
  const upiCollection = paidOrders.filter(o=>o.payment_method==='UPI').reduce((sum,o)=>sum+Number(o.total || 0),0);
  const cashCollection = paidOrders.filter(o=>o.payment_method==='COD').reduce((sum,o)=>sum+Number(o.total || 0),0);
  const pendingPayment = deliveredOnDate.filter(o=>o.payment_status!=='paid').reduce((sum,o)=>sum+Number(o.total || 0),0);
  const currentlyPending = orders.filter(o=>o.delivery_partner_id && !['delivered','cancelled'].includes(o.order_status));

  function partnerReport(partner) {
    const partnerAssigned = assignedOnDate.filter(o=>Number(o.delivery_partner_id)===Number(partner.id));
    const partnerDelivered = deliveredOnDate.filter(o=>Number(o.delivery_partner_id)===Number(partner.id));
    const partnerPaid = partnerDelivered.filter(o=>o.payment_status==='paid');
    return {
      assigned:partnerAssigned.length,
      delivered:partnerDelivered.length,
      pending:partnerAssigned.filter(o=>!['delivered','cancelled'].includes(o.order_status)).length,
      amount:partnerDelivered.reduce((s,o)=>s+Number(o.total || 0),0),
      collected:partnerPaid.reduce((s,o)=>s+Number(o.total || 0),0)
    };
  }

  if (!session) {
    return <main className="admin">
      <h1>Chetan Kirana Admin</h1>
      <p>केवल अधिकृत एडमिन लॉगिन करें।</p>
      <form onSubmit={login}>
        <input type="email" required placeholder="Admin email" value={email} onChange={e=>setEmail(e.target.value)}/>
        <input type="password" required placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)}/>
        <button className="place-order">Login</button>
      </form>
      {message && <p className="notice">{message}</p>}
      <a href="/">← दुकान पर वापस जाएँ</a>
    </main>;
  }

  return <main className="admin">
    <div className="section-heading">
      <h1>Chetan Kirana Admin</h1>
      <button onClick={async()=>{await supabase.auth.signOut();setSession(null);}}>Logout</button>
    </div>

    <div className="chips">
      <button className={activeTab==='orders'?'selected':''} onClick={()=>setActiveTab('orders')}>ऑर्डर ({orders.length})</button>
      <button className={activeTab==='delivery'?'selected':''} onClick={()=>setActiveTab('delivery')}>Delivery Boys ({deliveryPartners.length})</button>
      <button className={activeTab==='report'?'selected':''} onClick={()=>{setActiveTab('report');setReportLoading(true);Promise.all([loadOrders(),loadDeliveryPartners()]).finally(()=>setReportLoading(false));}}>📊 Delivery Report</button>
      <button className={activeTab==='products'?'selected':''} onClick={()=>setActiveTab('products')}>Products ({products.length})</button>
    </div>

    {message && <p className="notice">{message}</p>}

    {activeTab==='orders' && <>
      <div className="section-heading">
        <h2>सभी ऑर्डर</h2>
        <button onClick={()=>{loadOrders();loadDeliveryPartners();}} disabled={loadingOrders}>{loadingOrders?'लोड हो रहा है...':'Refresh'}</button>
      </div>
      <input placeholder="Order ID, ग्राहक नाम, मोबाइल या UTR खोजें..." value={searchOrder} onChange={e=>setSearchOrder(e.target.value)}/>
      <div className="bill-row"><b>कुल ऑर्डर</b><b>{orders.length}</b></div>
      {loadingOrders && <p>ऑर्डर लोड हो रहे हैं...</p>}
      {!loadingOrders && filteredOrders.length===0 && <p>कोई ऑर्डर नहीं मिला।</p>}

      {filteredOrders.map(o=>{
        const assignedPartner = deliveryPartners.find(p=>Number(p.id)===Number(o.delivery_partner_id));
        return <div className="panel" key={o.id} style={{marginBottom:'18px'}}>
          <div className="section-heading"><h3>{o.order_number}</h3><b>₹{o.total}</b></div>
          <p><b>ग्राहक:</b> {o.customer_name}</p>
          <p><b>मोबाइल:</b> <a href={`tel:${o.mobile}`}>{o.mobile}</a></p>
          <p><b>डिलीवरी पता:</b> {o.delivery_address}</p>
          {o.note && <p><b>निर्देश:</b> {o.note}</p>}
          <p><b>ऑर्डर समय:</b> {o.created_at?new Date(o.created_at).toLocaleString('en-IN'):'उपलब्ध नहीं'}</p>
          {o.delivered_at && <p><b>Delivered समय:</b> {new Date(o.delivered_at).toLocaleString('en-IN')}</p>}
          <hr/><h4>ऑर्डर के सामान</h4>
          {(o.order_items || []).map(item=><div className="bill-row" key={item.id}><span>{item.product_name} × {item.quantity}</span><b>₹{item.line_total}</b></div>)}
          <hr/>
          <div className="bill-row"><span>सामान का कुल</span><b>₹{o.subtotal}</b></div>
          <div className="bill-row"><span>डिलीवरी चार्ज</span><b>₹{o.delivery_fee}</b></div>
          <div className="bill-row grand-total"><span>कुल राशि</span><b>₹{o.total}</b></div>
          <p><b>भुगतान तरीका:</b> {o.payment_method==='COD'?'Cash on Delivery':'UPI'}</p>
          <p><b>भुगतान स्थिति:</b> {o.payment_status==='paid'?'Paid':'Pending'}</p>

          {o.payment_method==='UPI' && <div className="panel" style={{marginTop:'10px'}}>
            <h4>UPI Payment Verification</h4>
            <p><b>ग्राहक का UTR / Transaction ID:</b><br/>{o.payment_reference || 'अभी UTR जमा नहीं हुआ है।'}</p>
            <p><b>UTR जमा करने का समय:</b><br/>{o.payment_submitted_at?new Date(o.payment_submitted_at).toLocaleString('en-IN'):'उपलब्ध नहीं'}</p>
            <p className="fine-print">UTR देखकर अकेले भुगतान Confirm न करें। अपने PhonePe या बैंक खाते में वास्तविक राशि जाँचें।</p>
          </div>}
          {o.payment_status!=='paid' && <button onClick={()=>markPaymentReceived(o.id)}>भुगतान प्राप्त हुआ</button>}
          <hr/>
          <div style={{padding:'14px',border:'1px solid #cbd5e1',borderRadius:'10px',margin:'12px 0',background:'#f8fafc'}}>
            <h4 style={{marginTop:0}}>🛵 Delivery Boy Assign करें</h4>
            {assignedPartner && <p><b>अभी Assign:</b> {assignedPartner.name} — {assignedPartner.mobile}</p>}
            <select value={o.delivery_partner_id || ''} onChange={e=>assignDeliveryPartner(o.id,e.target.value)} style={{display:'block',width:'100%',padding:'12px',marginTop:'8px'}}>
              <option value="">Delivery Boy चुनें / हटाएँ</option>
              {deliveryPartners.filter(p=>p.is_active).map(p=><option key={p.id} value={p.id}>{p.name} — {p.mobile}</option>)}
            </select>
            {!deliveryPartners.some(p=>p.is_active) && <p className="fine-print">पहले Delivery Boys टैब में एक Active Delivery Boy जोड़ें।</p>}
          </div>
          <label><b>ऑर्डर स्टेटस बदलें</b></label>
          <select value={o.order_status} onChange={e=>updateOrderStatus(o.id,e.target.value)} style={{display:'block',width:'100%',padding:'12px',marginTop:'8px'}}>
            {orderStatuses.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <p><b>वर्तमान स्थिति:</b> {statusLabel(o.order_status)}</p>
        </div>;
      })}
    </>}

    {activeTab==='report' && <>
      <div className="section-heading">
        <h2>📊 Daily Delivery Report</h2>
        <button onClick={async()=>{setReportLoading(true);await Promise.all([loadOrders(),loadDeliveryPartners()]);setReportLoading(false);}} disabled={reportLoading}>
          {reportLoading?'लोड हो रहा है...':'Refresh Report'}
        </button>
      </div>

      <div className="panel">
        <label><b>रिपोर्ट की तारीख चुनें</b></label>
        <input type="date" value={reportDate} onChange={e=>setReportDate(e.target.value)} style={{display:'block',width:'100%',padding:'12px',marginTop:'8px'}}/>
        <p className="fine-print">Selected date: {reportDate ? new Date(`${reportDate}T00:00:00`).toLocaleDateString('en-IN') : 'तारीख चुनें'}</p>
      </div>

      {reportLoading && <p>रिपोर्ट लोड हो रही है...</p>}

      <div className="panel">
        <h3>📦 ऑर्डर सारांश</h3>
        <div className="bill-row"><span>इस तारीख को बने और Assign हुए ऑर्डर</span><b>{assignedOnDate.length}</b></div>
        <div className="bill-row"><span>इस तारीख को Delivered</span><b>{deliveredOnDate.length}</b></div>
        <div className="bill-row"><span>उसी तारीख के अभी Pending</span><b>{pendingOnDate.length}</b></div>
        <div className="bill-row"><span>सभी तारीखों के वर्तमान Pending Assigned Orders</span><b>{currentlyPending.length}</b></div>
        <div className="bill-row grand-total"><span>Delivered Orders की कुल राशि</span><b>{money(deliveredTotal)}</b></div>
      </div>

      <div className="panel">
        <h3>💰 Payment Collection</h3>
        <div className="bill-row"><span>कुल Delivered Orders</span><b>{money(deliveredTotal)}</b></div>
        <div className="bill-row"><span>UPI से Paid Collection</span><b>{money(upiCollection)}</b></div>
        <div className="bill-row"><span>COD से Paid Collection</span><b>{money(cashCollection)}</b></div>
        <div className="bill-row grand-total"><span>कुल वास्तविक Paid Collection</span><b>{money(paidTotal)}</b></div>
        <div className="bill-row"><span>Delivered लेकिन Payment Pending</span><b>{money(pendingPayment)}</b></div>
        <p className="fine-print">Collection में केवल Admin द्वारा Paid किए गए ऑर्डर शामिल हैं। COD का भुगतान वास्तव में प्राप्त होने के बाद ही Admin में Paid करें।</p>
      </div>

      <div className="panel">
        <h3>🛵 Delivery Boy Wise Report</h3>
        {deliveryPartners.length===0 && <p>अभी कोई Delivery Boy उपलब्ध नहीं है।</p>}
        {deliveryPartners.map(p=>{
          const r = partnerReport(p);
          return <div key={p.id} style={{border:'1px solid #ddd',borderRadius:'10px',padding:'12px',marginBottom:'12px'}}>
            <div className="section-heading">
              <b>{p.name}</b>
              <span style={{color:p.is_active?'#15803d':'#b91c1c'}}>{p.is_active?'Active':'Inactive'}</span>
            </div>
            <p><b>मोबाइल:</b> {p.mobile}</p>
            <div className="bill-row"><span>Assigned (चुनी तारीख)</span><b>{r.assigned}</b></div>
            <div className="bill-row"><span>Delivered (चुनी तारीख)</span><b>{r.delivered}</b></div>
            <div className="bill-row"><span>Pending (चुनी तारीख के)</span><b>{r.pending}</b></div>
            <div className="bill-row"><span>Delivered Amount</span><b>{money(r.amount)}</b></div>
            <div className="bill-row grand-total"><span>Paid Collection</span><b>{money(r.collected)}</b></div>
          </div>;
        })}
      </div>

      <div className="panel">
        <h3>✅ Delivered Orders — {reportDate}</h3>
        {deliveredOnDate.length===0 && <p>इस तारीख पर कोई नया Delivered Order नहीं मिला।</p>}
        {deliveredOnDate.map(o=>{
          const partner = deliveryPartners.find(p=>Number(p.id)===Number(o.delivery_partner_id));
          return <div key={o.id} style={{borderBottom:'1px solid #ddd',padding:'12px 0'}}>
            <div className="section-heading"><b>{o.order_number}</b><b>{money(o.total)}</b></div>
            <p><b>ग्राहक:</b> {o.customer_name} — {o.mobile}</p>
            <p><b>Delivery Boy:</b> {partner?.name || 'रिकॉर्ड उपलब्ध नहीं'}</p>
            <p><b>Delivered समय:</b> {o.delivered_at?new Date(o.delivered_at).toLocaleString('en-IN'):'उपलब्ध नहीं'}</p>
            <p><b>Payment:</b> {o.payment_method==='COD'?'COD':'UPI'} — {o.payment_status==='paid'?'Paid':'Pending'}</p>
          </div>;
        })}
      </div>

      <div className="panel">
        <h3>⏳ Pending Orders — {reportDate}</h3>
        {pendingOnDate.length===0 && <p>इस तारीख के कोई Pending Assigned Orders नहीं हैं।</p>}
        {pendingOnDate.map(o=>{
          const partner = deliveryPartners.find(p=>Number(p.id)===Number(o.delivery_partner_id));
          return <div key={o.id} style={{borderBottom:'1px solid #ddd',padding:'12px 0'}}>
            <b>{o.order_number}</b> — {money(o.total)}
            <p>ग्राहक: {o.customer_name} | {o.mobile}</p>
            <p>Delivery Boy: {partner?.name || 'रिकॉर्ड उपलब्ध नहीं'}</p>
            <p>स्थिति: {statusLabel(o.order_status)}</p>
          </div>;
        })}
      </div>

      <p className="fine-print">नोट: Assigned Orders की तारीख Order Created Date पर आधारित है। Delivered Orders की तारीख वास्तविक delivered_at timestamp पर आधारित है। SQL जोड़ने से पहले के पुराने Delivered Orders में delivered_at खाली हो सकता है, इसलिए वे पुरानी तारीख की Delivered Report में दिखाई नहीं देंगे।</p>
    </>}

    {activeTab==='delivery' && <>
      <h2>🛵 Delivery Boy Management</h2>
      <p>नया Delivery Boy जोड़ते समय उसका 6 अंकों का Login PIN सेट करें।</p>
      <div className="panel">
        <h3>नया Delivery Boy जोड़ें</h3>
        <form onSubmit={addDeliveryPartner}>
          <input required placeholder="Delivery Boy का पूरा नाम" value={newPartner.name} onChange={e=>setNewPartner({...newPartner,name:e.target.value})}/>
          <input required type="tel" inputMode="numeric" maxLength={10} placeholder="10 अंकों का मोबाइल नंबर" value={newPartner.mobile} onChange={e=>setNewPartner({...newPartner,mobile:e.target.value.replace(/\D/g,'').slice(0,10)})}/>
          <input required type="password" inputMode="numeric" maxLength={6} placeholder="6 अंकों का Login PIN" value={newPartner.pin} onChange={e=>setNewPartner({...newPartner,pin:e.target.value.replace(/\D/g,'').slice(0,6)})}/>
          <small className="fine-print">यह PIN Delivery Boy को Login के लिए दें। PIN किसी के साथ सार्वजनिक रूप से साझा न करें।</small>
          <button className="place-order" disabled={savingPartner}>{savingPartner?'सेव हो रहा है...':'Delivery Boy सेव करें और PIN सेट करें'}</button>
        </form>
      </div>

      <div className="section-heading"><h2>Delivery Boys ({deliveryPartners.length})</h2><button onClick={loadDeliveryPartners}>Refresh</button></div>
      {!deliveryPartners.length && <p>अभी कोई Delivery Boy जोड़ा नहीं गया है।</p>}
      {deliveryPartners.map(p=><div className="panel" key={p.id} style={{marginBottom:'12px'}}>
        <div className="section-heading"><h3>{p.name}</h3><b style={{color:p.is_active?'#15803d':'#b91c1c'}}>{p.is_active?'Active':'Inactive'}</b></div>
        <p><b>मोबाइल:</b> <a href={`tel:${p.mobile}`}>{p.mobile}</a></p>
        <div style={{padding:'12px',background:'#f8fafc',borderRadius:'10px',margin:'12px 0'}}>
          <b>🔐 PIN सेट / Reset करें</b>
          <input type="password" inputMode="numeric" maxLength={6} placeholder="नया 6 अंकों का PIN" value={partnerPinInputs[p.id] || ''} onChange={e=>setPartnerPinInputs(current=>({...current,[p.id]:e.target.value.replace(/\D/g,'').slice(0,6)}))}/>
          <button className="place-order" disabled={savingPartnerPin===p.id} onClick={()=>setDeliveryPartnerPin(p.id)}>{savingPartnerPin===p.id?'PIN सेव हो रहा है...':'PIN सेट / Reset करें'}</button>
          <p className="fine-print">PIN Reset करने पर Delivery Boy का पुराना Login Session बंद हो जाएगा।</p>
        </div>
        <button onClick={()=>toggleDeliveryPartner(p)}>{p.is_active?'Inactive करें':'फिर Active करें'}</button>
      </div>)}
    </>}

    {activeTab==='products' && <>
      <h2>नया उत्पाद जोड़ें</h2>
      <form onSubmit={saveProduct}>
        <input required placeholder="उत्पाद का नाम" value={product.name} onChange={e=>setProduct({...product,name:e.target.value})}/>
        <select required value={product.category_id} onChange={e=>setProduct({...product,category_id:e.target.value})}>
          <option value="">Category चुनें</option>
          {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input required type="number" min="0" step="0.01" placeholder="कीमत ₹" value={product.price} onChange={e=>setProduct({...product,price:e.target.value})}/>
        <input type="number" min="0" step="1" placeholder="Stock" value={product.stock} onChange={e=>setProduct({...product,stock:e.target.value})}/>
        <textarea placeholder="छोटा विवरण" value={product.description} onChange={e=>setProduct({...product,description:e.target.value})}/>
        <button className="place-order" disabled={!categories.length}>उत्पाद सेव करें</button>
        {!categories.length && <p>पहले Categories Table में Category जोड़ें।</p>}
      </form>
      <h2>उत्पाद सूची ({products.length})</h2>
      {products.map(p=><div className="admin-product" key={p.id}>
        <b>{p.name}</b><span>₹{p.price}</span><span>Stock: {p.stock}</span><span>{p.category?.name || 'अन्य'}</span>
        <label>फोटो अपलोड<input type="file" accept="image/*" onChange={e=>uploadImage(e,p)}/></label>
        <button onClick={()=>toggleProduct(p)}>{p.is_active?'दुकान से हटाएँ':'फिर चालू करें'}</button>
      </div>)}
    </>}

    <a href="/">← दुकान पर वापस जाएँ</a>
  </main>;
}

function DeliveryPartnerPanel() {
  const [mobile,setMobile] = useState('');
  const [pin,setPin] = useState('');
  const [token,setToken] = useState('');
  const [partner,setPartner] = useState(null);
  const [orders,setOrders] = useState([]);
  const [message,setMessage] = useState('');
  const [loading,setLoading] = useState(false);
  const [loadingOrders,setLoadingOrders] = useState(false);

  useEffect(()=>{
    const savedToken = localStorage.getItem('ck_delivery_token');
    const savedPartner = localStorage.getItem('ck_delivery_partner');
    if (savedToken && savedPartner) {
      try {
        setToken(savedToken);
        setPartner(JSON.parse(savedPartner));
        loadPartnerOrders(savedToken);
      } catch {
        clearSavedLogin();
      }
    }
  },[]);

  function clearSavedLogin() {
    localStorage.removeItem('ck_delivery_token');
    localStorage.removeItem('ck_delivery_partner');
    setToken('');
    setPartner(null);
    setOrders([]);
  }

  async function loadPartnerOrders(currentToken=token) {
    if (!currentToken || !supabase) return;
    setLoadingOrders(true);
    try {
      const {data,error} = await supabase.rpc('delivery_partner_orders',{p_token:currentToken});
      if (error) {
        setMessage('Orders Load Error: '+error.message);
        return;
      }
      if (!data?.success) {
        setMessage(data?.message || 'Login समाप्त हुआ। दोबारा Login करें।');
        clearSavedLogin();
        return;
      }
      setOrders(data.orders || []);
      setMessage('');
    } finally {
      setLoadingOrders(false);
    }
  }

  async function login(e) {
    e.preventDefault();
    setMessage('');
    const cleanMobile = mobile.trim();
    const cleanPin = pin.trim();
    if (!/^[6-9][0-9]{9}$/.test(cleanMobile)) return setMessage('सही 10 अंकों का मोबाइल नंबर दर्ज करें।');
    if (!/^[0-9]{6}$/.test(cleanPin)) return setMessage('PIN ठीक 6 अंकों का होना चाहिए।');
    if (!supabase) return setMessage('Database कनेक्शन उपलब्ध नहीं है।');

    setLoading(true);
    try {
      const {data,error} = await supabase.rpc('delivery_partner_login',{p_mobile:cleanMobile,p_pin:cleanPin});
      if (error) {
        setMessage('Login Error: '+error.message);
        return;
      }
      if (!data?.success || !data?.token || !data?.partner) {
        setMessage(data?.message || 'मोबाइल नंबर या PIN गलत है।');
        return;
      }
      localStorage.setItem('ck_delivery_token',data.token);
      localStorage.setItem('ck_delivery_partner',JSON.stringify(data.partner));
      setToken(data.token);
      setPartner(data.partner);
      setPin('');
      setMessage('Login सफल हुआ।');
      await loadPartnerOrders(data.token);
    } catch (error) {
      console.error(error);
      setMessage('Login करते समय तकनीकी समस्या आई।');
    } finally {
      setLoading(false);
    }
  }

  async function markDelivered(order) {
    const confirmed = window.confirm(`क्या Order ${order.order_number} ग्राहक को सफलतापूर्वक दे दिया गया है?`);
    if (!confirmed) return;
    setMessage('');
    setLoading(true);
    try {
      const {data,error} = await supabase.rpc('delivery_partner_mark_delivered',{p_token:token,p_order_id:Number(order.id)});
      if (error) {
        setMessage('Status Update Error: '+error.message);
        return;
      }
      if (!data?.success) {
        setMessage(data?.message || 'ऑर्डर Delivered अपडेट नहीं हुआ।');
        return;
      }
      setMessage('ऑर्डर Delivered अपडेट हो गया।');
      await loadPartnerOrders(token);
    } catch (error) {
      console.error(error);
      setMessage('Status अपडेट करते समय समस्या आई।');
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    const currentToken = token;
    try {
      if (currentToken && supabase) await supabase.rpc('delivery_partner_logout',{p_token:currentToken});
    } catch (error) {
      console.error(error);
    }
    clearSavedLogin();
    setMessage('आप Logout हो गए हैं।');
  }

  function statusLabel(status) {
    return orderStatuses.find(s=>s.value===status)?.label || status;
  }

  if (!partner || !token) {
    return <main className="admin" style={{maxWidth:'480px',margin:'30px auto'}}>
      <div className="panel">
        <div style={{textAlign:'center',fontSize:'48px'}}>🛵</div>
        <h1 style={{textAlign:'center'}}>Delivery Boy Login</h1>
        <p style={{textAlign:'center'}}>Chetan Kirana Delivery Panel</p>
        <form onSubmit={login}>
          <label>मोबाइल नंबर</label>
          <input type="tel" inputMode="numeric" maxLength={10} placeholder="10 अंकों का मोबाइल नंबर" value={mobile} onChange={e=>setMobile(e.target.value.replace(/\D/g,'').slice(0,10))} required/>
          <label>6 Digit PIN</label>
          <input type="password" inputMode="numeric" maxLength={6} placeholder="अपना 6 अंकों का PIN डालें" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,6))} required/>
          <button className="place-order" disabled={loading}>{loading?'Login हो रहा है...':'Login करें'}</button>
        </form>
        {message && <p className="notice">{message}</p>}
        <p className="fine-print">PIN Admin द्वारा दिया जाएगा। लगातार 5 बार गलत PIN डालने पर Login 15 मिनट के लिए Lock हो जाएगा।</p>
        <a href="/">← दुकान पर वापस जाएँ</a>
      </div>
    </main>;
  }

  return <main className="admin" style={{maxWidth:'850px',margin:'20px auto'}}>
    <div className="section-heading">
      <div><h1>🛵 Delivery Panel</h1><p>नमस्ते, <b>{partner.name}</b></p><small>{partner.mobile}</small></div>
      <button onClick={logout}>Logout</button>
    </div>
    {message && <p className="notice">{message}</p>}
    <div className="section-heading">
      <h2>मेरे Assigned Orders ({orders.length})</h2>
      <button onClick={()=>loadPartnerOrders(token)} disabled={loadingOrders}>{loadingOrders?'लोड हो रहा है...':'Refresh'}</button>
    </div>
    {loadingOrders && <p>ऑर्डर लोड हो रहे हैं...</p>}
    {!loadingOrders && orders.length===0 && <div className="panel"><h3>अभी कोई ऑर्डर Assign नहीं है।</h3><p>Admin द्वारा ऑर्डर Assign किए जाने पर यहाँ दिखाई देंगे।</p></div>}

    {orders.map(order=><div className="panel" key={order.id} style={{marginBottom:'16px'}}>
      <div className="section-heading"><h3>{order.order_number}</h3><b>₹{order.total}</b></div>
      <p><b>ग्राहक:</b> {order.customer_name}</p>
      <p><b>मोबाइल:</b> <a href={`tel:${order.mobile}`}>{order.mobile}</a></p>
      <a href={`tel:${order.mobile}`} className="place-order" style={{display:'block',textAlign:'center',textDecoration:'none',margin:'10px 0'}}>📞 ग्राहक को Call करें</a>
      <p><b>डिलीवरी पता:</b><br/>{order.delivery_address}</p>
      {order.note && <p><b>ग्राहक निर्देश:</b> {order.note}</p>}
      <p><b>ऑर्डर समय:</b> {order.created_at?new Date(order.created_at).toLocaleString('en-IN'):'उपलब्ध नहीं'}</p>
      <hr/><h4>ऑर्डर के सामान</h4>
      {(order.items || []).map((item,index)=><div className="bill-row" key={index}><span>{item.product_name} × {item.quantity}</span></div>)}
      <hr/>
      <p><b>भुगतान तरीका:</b> {order.payment_method==='COD'?'Cash on Delivery':'UPI'}</p>
      <p><b>भुगतान स्थिति:</b> {order.payment_status==='paid'?'Paid':'Pending'}</p>
      <p><b>ऑर्डर स्थिति:</b> {statusLabel(order.order_status)}</p>
      {order.order_status==='out_for_delivery' ? <button className="place-order" disabled={loading} onClick={()=>markDelivered(order)}>{loading?'अपडेट हो रहा है...':'✓ ग्राहक को सामान दे दिया — Delivered करें'}</button> :
        order.order_status==='delivered' ? <p style={{padding:'12px',background:'#dcfce7',color:'#15803d',borderRadius:'8px',fontWeight:'bold'}}>✓ यह ऑर्डर Delivered हो चुका है।</p> :
        <p className="fine-print">Admin द्वारा ऑर्डर को Out for Delivery किए जाने के बाद Delivered बटन दिखाई देगा।</p>}
    </div>)}
    <p className="fine-print">ऑर्डर की स्थिति केवल उन्हीं ऑर्डर के लिए अपडेट की जा सकती है जो आपके नाम पर Assign हैं।</p>
  </main>;
}
