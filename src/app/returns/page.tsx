'use client';
import { useState } from 'react';

function Nav({ step, total, orderNum }: { step?: number; total?: number; orderNum?: string }) {
  return (
    <div className="bg-white border-b border-[#eae7e2] px-4 sm:px-8 py-3 flex items-center justify-between sticky top-0 z-10">
      <span className="text-sm text-[#888]">{orderNum ? `Order #${orderNum}` : ''}</span>
      <img src="/logo-black.png" alt="Miss Finch NYC" className="h-7 sm:h-8" />
      <span className="text-xs text-[#888] tracking-wide">{step && total ? `Step ${step} of ${total}` : ''}</span>
    </div>
  );
}

function Btn({ children, onClick, disabled, outline }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; outline?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`px-8 py-3.5 rounded-[10px] text-[15px] font-medium transition-colors ${outline ? 'bg-white border border-[#d5d0c9] text-[#666] hover:bg-[#f5f3ee]' : disabled ? 'bg-[#ccc] text-white cursor-not-allowed' : 'bg-[#1a1a1a] text-white hover:bg-[#333]'}`}>
      {children}
    </button>
  );
}

function Login({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="max-w-[420px] w-full">
        <div className="text-center mb-10"><img src="/logo-black.png" alt="Miss Finch NYC" className="h-14 mx-auto" /></div>
        <div className="bg-white border border-[#eae7e2] rounded-[14px] p-8">
          <div className="text-center mb-7">
            <h1 className="text-xl font-medium text-[#1a1a1a]">Returns & exchanges</h1>
            <p className="text-sm text-[#777] mt-1.5">Find your order to get started</p>
          </div>
          <div className="mb-4">
            <label className="text-sm text-[#666] block mb-1.5">Email or zip code</label>
            <input type="text" placeholder="you@email.com or 10001" className="w-full px-4 py-3.5 border border-[#ddd] rounded-[10px] text-[15px] focus:outline-none focus:border-[#1a1a1a] transition-colors" />
          </div>
          <div className="mb-6">
            <label className="text-sm text-[#666] block mb-1.5">Order number</label>
            <input type="text" placeholder="e.g. 8657" className="w-full px-4 py-3.5 border border-[#ddd] rounded-[10px] text-[15px] focus:outline-none focus:border-[#1a1a1a] transition-colors" />
          </div>
          <button onClick={onLogin} className="w-full bg-[#1a1a1a] text-white py-4 rounded-[10px] text-base font-medium hover:bg-[#333] transition-colors">Find my order</button>
          <div className="text-center mt-5 pt-4 border-t border-[#eee]">
            <a href="https://missfinchnyc.com/pages/miss-finch-nyc-return-policy" className="text-xs text-[#888] underline underline-offset-2">View return policy</a>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderDetails({ onStart }: { onStart: () => void }) {
  return (<><Nav orderNum="8650" />
    <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-8">
      <div className="flex justify-between items-start mb-6 flex-wrap gap-4">
        <div><h1 className="text-2xl font-semibold">Order #8650</h1><p className="text-sm text-[#777] mt-1">Online Store · Apr 2, 2026</p></div>
        <Btn onClick={onStart}>Start a return</Btn>
      </div>
      <div className="flex gap-6 flex-wrap">
        <div className="flex-1 min-w-[340px]">
          <div className="bg-white border border-[#eae7e2] rounded-[14px] p-5">
            <div className="flex justify-between items-center mb-4"><span className="text-sm font-medium">Shipment 1 of 1</span><span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-[#E1F5EE] text-[#0F6E56]">Delivered</span></div>
            {[{name:'Noir Garden Midi Dress',size:'M',r:140,p:119},{name:'Indigo Fern Shirt Dress',size:'M',r:178,p:151.30}].map((it,i)=>(
              <div key={i} className="flex gap-3 py-3 border-t border-[#f0ede8]">
                <div className="w-[70px] h-[88px] bg-[#f5f3ee] rounded-lg flex-shrink-0" />
                <div className="flex-1"><div className="text-sm font-medium">{it.name}</div><div className="text-xs text-[#777] mt-0.5">Size: {it.size}</div></div>
                <div className="text-right flex-shrink-0"><div className="text-xs text-[#999] line-through">${it.r.toFixed(2)}</div><div className="text-[15px] font-semibold">${it.p.toFixed(2)}</div></div>
              </div>))}
            <div className="pt-3 border-t border-[#f0ede8] text-xs text-[#777]"><span className="font-medium text-[#666]">Carrier:</span> UPS · 1ZK533D50331486061</div>
          </div>
        </div>
        <div className="w-[260px] flex-shrink-0">
          <div className="bg-white border border-[#eae7e2] rounded-[14px] p-5" style={{background:'#FAF9F6'}}>
            <div className="text-sm font-semibold mb-3">Summary</div>
            <div className="text-sm space-y-2">
              <div className="flex justify-between"><span className="text-[#777]">Subtotal</span><span>$270.30</span></div>
              <div className="flex justify-between"><span className="text-[#777]">Discounts</span><span className="text-[#D85A30]">-$47.70</span></div>
              <div className="flex justify-between pt-2 border-t border-[#eae7e2] font-semibold"><span>Total</span><span>$270.30</span></div>
            </div>
          </div>
          <div className="text-center mt-4"><div className="text-xs text-[#888]">14-day return window</div><div className="text-xs text-[#0F6E56] font-medium mt-0.5">11 days remaining</div></div>
        </div>
      </div>
    </div></>);
}

function SelectItems({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  const [sel, setSel] = useState<number[]>([]);
  const items = [{name:'Noir Garden Midi Dress',size:'M',r:140,p:119},{name:'Indigo Fern Shirt Dress',size:'M',r:178,p:151.30}];
  const toggle = (i: number) => setSel(s => s.includes(i) ? s.filter(x=>x!==i) : [...s,i]);
  return (<><Nav orderNum="8650" step={1} total={5} />
    <div className="max-w-[680px] mx-auto px-4 sm:px-6 py-8">
      <div className="text-center mb-8"><h1 className="text-[22px] font-medium">Select items to return</h1><p className="text-sm text-[#777] mt-1.5">Choose the items you wish to return or exchange</p></div>
      {items.map((it,i)=>{const a=sel.includes(i);return(
        <div key={i} onClick={()=>toggle(i)} className={`flex gap-3 items-center p-5 bg-white rounded-[14px] mb-3 cursor-pointer transition-all ${a?'border-2 border-[#1a1a1a]':'border border-[#eae7e2]'}`}>
          <div className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center text-xs ${a?'bg-[#1a1a1a] text-white':'border-[1.5px] border-[#ccc]'}`}>{a&&'✓'}</div>
          <div className="w-[70px] h-[88px] bg-[#f5f3ee] rounded-lg flex-shrink-0" />
          <div className="flex-1"><div className="text-sm font-medium">{it.name}</div><div className="text-xs text-[#777]">Size: {it.size}</div></div>
          <div className="text-right"><div className="text-xs text-[#999] line-through">${it.r.toFixed(2)}</div><div className="text-[15px] font-semibold">${it.p.toFixed(2)}</div></div>
        </div>);})}
      <div className="flex justify-between mt-8"><Btn outline onClick={onBack}>Previous</Btn><Btn disabled={sel.length===0} onClick={onContinue}>Continue</Btn></div>
    </div></>);
}

function ReturnReasons({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  const [reason, setReason] = useState('');
  const [modal, setModal] = useState(true);
  const reasons = ['Fit/Sizing — Too big','Fit/Sizing — Too small','Fit/Sizing — Didn\'t like fit','Not what I expected','Did not like fabric','Changed mind','Ordered multiple sizes','Received wrong item','Item is damaged'];
  return (<><Nav orderNum="8650" step={2} total={5} />
    <div className="max-w-[680px] mx-auto px-4 sm:px-6 py-8">
      <div className="text-center mb-8"><h1 className="text-[22px] font-medium">Add return reasons</h1><p className="text-sm text-[#777] mt-1.5">Tell us why you are returning these items</p></div>
      <div className="bg-white border border-[#eae7e2] rounded-[14px] p-5 flex gap-3 items-center">
        <div className="w-[70px] h-[88px] bg-[#f5f3ee] rounded-lg flex-shrink-0" />
        <div className="flex-1"><div className="text-sm font-medium">Noir Garden Midi Dress</div><div className="text-xs text-[#777]">$119.00 / M</div></div>
        <button onClick={()=>setModal(true)} className={`px-4 py-2 rounded-lg text-sm font-medium ${reason?'bg-[#E1F5EE] text-[#0F6E56]':'bg-[#1a1a1a] text-white'}`}>{reason?'✓ '+reason.split(' — ')[0]:'Add details'}</button>
      </div>
      <div className="flex justify-between mt-8"><Btn outline onClick={onBack}>Previous</Btn><Btn disabled={!reason} onClick={onContinue}>Continue</Btn></div>
    </div>
    {modal&&<div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[14px] max-w-[480px] w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <div className="flex gap-3 items-center"><div className="w-[50px] h-[62px] bg-[#f5f3ee] rounded-lg flex-shrink-0" /><div><div className="text-sm font-medium">Noir Garden Midi Dress</div><div className="text-xs text-[#777]">$119.00 / M</div></div></div>
          <button onClick={()=>{if(reason)setModal(false)}} className="text-[#888] text-lg">✕</button>
        </div>
        <h3 className="text-base font-medium mb-3">Why are you returning this item?</h3>
        <div className="space-y-2">{reasons.map(r=>(<button key={r} onClick={()=>setReason(r)} className={`w-full text-left px-4 py-3 rounded-[10px] text-sm transition-all ${reason===r?'border-2 border-[#1a1a1a] font-medium':'border border-[#eae7e2] hover:border-[#999]'}`}>{r}</button>))}</div>
        <button onClick={()=>setModal(false)} disabled={!reason} className={`w-full mt-4 py-3.5 rounded-[10px] text-sm font-medium ${reason?'bg-[#1a1a1a] text-white':'bg-[#ccc] text-white cursor-not-allowed'}`}>Continue</button>
      </div>
    </div>}</>);
}

function ReturnMethod({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  const [method, setMethod] = useState('');
  const v=119, fee=Math.round(v*0.05*100)/100, bonus=Math.round(v*0.05*100)/100;
  return (<><Nav orderNum="8650" step={3} total={5} />
    <div className="max-w-[780px] mx-auto px-4 sm:px-6 py-8">
      <div className="text-center mb-6"><h1 className="text-[22px] font-medium">How would you like to be compensated?</h1><p className="text-sm text-[#777] mt-1.5">Noir Garden Midi Dress · Size M · $119.00</p></div>
      <div className="bg-[#E8F5EE] border-[1.5px] border-[#B8E6D0] rounded-[14px] p-5 mb-6">
        <div className="flex justify-between items-center mb-3"><div><div className="text-sm font-semibold text-[#0F6E56]">Need a different size?</div><div className="text-xs text-[#1D9E75] mt-0.5">Same dress, free exchange — no fees</div></div><span className="text-[10px] font-semibold px-2.5 py-1 rounded-md bg-[#E1F5EE] text-[#0F6E56]">Recommended</span></div>
        <div className="flex gap-2 flex-wrap">
          {['XS','S','M','L','XL'].map(s=>(<button key={s} className={`px-5 py-2.5 rounded-lg text-sm border-[1.5px] ${s==='M'?'border-[#1D9E75] bg-[#D4F0E2] font-semibold text-[#085041]':'border-[#B8E6D0] bg-white text-[#085041]'}`}>{s}{s==='M'?' ✓':''}</button>))}
          <button className="px-5 py-2.5 rounded-lg text-sm border border-[#e0ddd8] bg-[#f5f3ee] text-[#bbb] cursor-not-allowed">2XL</button>
        </div>
      </div>
      <div className="mb-6">
        <div className="text-[11px] font-semibold tracking-wider text-[#8a8680] uppercase mb-3">Or exchange for something new</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {['Midnight Elegance Pleated Midi','Sky Petals Midi Dress','Beige Blossom A-Line Skirt','Noir Print Midi Dress'].map((n,i)=>(
            <div key={i} className="bg-white border border-[#eae7e2] rounded-[14px] p-2.5 cursor-pointer hover:border-[#1a1a1a] transition-colors">
              <div className="w-full aspect-[3/4] bg-[#f5f3ee] rounded-lg mb-2" /><div className="text-xs font-medium leading-tight">{n}</div>
              <div className="text-[11px] mt-1"><span className="line-through text-[#aaa]">${[198,208,48,138][i]}</span> <span className="font-semibold text-[#0F6E56]">${[79,89,0,19][i]}.00</span></div>
            </div>))}
        </div>
      </div>
      <div className="border-t border-[#eae7e2] pt-6">
        <div className="text-[11px] font-semibold tracking-wider text-[#8a8680] uppercase mb-3">Or choose a return method</div>
        <div className="grid grid-cols-3 gap-3">
          <div onClick={()=>setMethod('exchange')} className={`rounded-[14px] p-5 cursor-pointer text-center relative border-[1.5px] border-[#1D9E75] bg-[#F0FAF5] ${method==='exchange'?'ring-2 ring-[#1D9E75]':''}`}>
            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#1D9E75] text-white text-[10px] font-semibold px-3 py-0.5 rounded-full">Best value</div>
            <div className="text-2xl mb-2">🔄</div><div className="text-[15px] font-semibold text-[#085041]">Exchange</div><div className="text-lg font-semibold text-[#0F6E56] mt-1">${v.toFixed(2)}</div><div className="text-xs text-[#1D9E75] mt-1">No fees</div>
          </div>
          <div onClick={()=>setMethod('credit')} className={`rounded-[14px] p-5 cursor-pointer text-center border-[1.5px] bg-white transition-colors ${method==='credit'?'border-[#1a1a1a] ring-2 ring-[#1a1a1a]':'border-[#eae7e2] hover:border-[#1a1a1a]'}`}>
            <div className="text-2xl mb-2">💳</div><div className="text-[15px] font-semibold">Store credit</div><div className="text-lg font-semibold mt-1">${(v+bonus).toFixed(2)}</div><div className="text-xs text-[#0F6E56] mt-1 font-medium">Includes 5% bonus</div>
          </div>
          <div onClick={()=>setMethod('refund')} className={`rounded-[14px] p-5 cursor-pointer text-center border-[1.5px] bg-white transition-colors ${method==='refund'?'border-[#1a1a1a] ring-2 ring-[#1a1a1a]':'border-[#eae7e2] hover:border-[#1a1a1a]'}`}>
            <div className="text-2xl mb-2">💰</div><div className="text-[15px] font-semibold">Refund</div><div className="text-lg font-semibold mt-1">${(v-fee).toFixed(2)}</div><div className="text-xs mt-1"><span className="text-[#D85A30] font-medium">${fee.toFixed(2)} fee</span></div>
          </div>
        </div>
      </div>
      <div className="flex justify-between mt-8"><Btn outline onClick={onBack}>Previous</Btn><Btn disabled={!method} onClick={onContinue}>Continue</Btn></div>
    </div></>);
}

function ReviewSubmit({ onSubmit, onBack }: { onSubmit: () => void; onBack: () => void }) {
  return (<><Nav orderNum="8650" step={5} total={5} />
    <div className="max-w-[900px] mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-semibold text-[#1a1a1a] mb-7">Review your return</h1>
      <div className="flex gap-8 flex-wrap">
        <div className="flex-1 min-w-[340px]">
          <div className="text-[10px] font-semibold tracking-wider text-[#8a8680] uppercase mb-3">Shipping information</div>
          <div className="text-sm text-[#666] leading-relaxed mb-6"><div className="font-medium text-[#1a1a1a]">Returning items from:</div>Lorena Videen<br/>8709 W VILLA LINDO DR<br/>PEORIA, AZ 85383-1832</div>
          <div className="text-[10px] font-semibold tracking-wider text-[#8a8680] uppercase mb-3">Shipment method</div>
          <div className="text-sm font-medium mb-1">Box and ship it back to us</div><div className="text-sm text-[#777]">Print a shipping label and bring it to a carrier</div>
        </div>
        <div className="w-[300px] flex-shrink-0">
          <div className="bg-white border border-[#eae7e2] rounded-[14px] p-5" style={{background:'#FAF9F6'}}>
            <div className="text-sm font-semibold mb-3">Return items (1)</div>
            <div className="flex gap-2.5 items-center pb-3 border-b border-[#eae7e2]"><div className="w-[50px] h-[62px] bg-[#f0ede8] rounded-lg flex-shrink-0" /><div className="flex-1"><div className="text-sm font-medium">Noir Garden Midi Dress</div><div className="text-[11px] text-[#777]">Size: M</div></div><div className="text-sm font-semibold">$119.00</div></div>
            <div className="pt-3 text-sm space-y-2">
              <div className="flex justify-between"><span className="text-[#777]">Return value</span><span>$119.00</span></div>
              <div className="flex justify-between"><span className="text-[#777]">5% bonus</span><span className="text-[#0F6E56]">+$5.95</span></div>
              <div className="flex justify-between pt-2 border-t border-[#eae7e2] font-semibold"><span>Store credit</span><span className="text-[#0F6E56]">$124.95</span></div>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-8 max-w-[480px]"><button onClick={onSubmit} className="w-full bg-[#1a1a1a] text-white py-4 rounded-[10px] text-base font-medium hover:bg-[#333]">Submit return</button></div>
    </div></>);
}

function Confirmation() {
  return (<><Nav />
    <div className="max-w-[680px] mx-auto px-4 sm:px-6 py-12 text-center">
      <div className="w-16 h-16 bg-[#E1F5EE] rounded-full flex items-center justify-center mx-auto mb-5 text-2xl">✓</div>
      <h1 className="text-2xl font-medium">Return submitted</h1><p className="text-sm text-[#777] mt-2">Return #RET-8650-001</p>
      <div className="bg-white border border-[#eae7e2] rounded-[14px] p-6 mt-7 text-left">
        <div className="text-sm font-medium mb-3">Your return label is ready</div>
        <p className="text-sm text-[#666] mb-4">Pack your items securely, attach the label, and drop off at any USPS location within <strong>7 days</strong>.</p>
        <button className="w-full bg-[#1a1a1a] text-white py-3.5 rounded-[10px] text-sm font-medium">Download shipping label (PDF)</button>
        <p className="text-xs text-[#888] text-center mt-2.5">We&apos;ll also email you a copy</p>
      </div>
      <div className="bg-white border border-[#eae7e2] rounded-[14px] p-6 mt-4 text-left">
        <div className="text-sm font-medium mb-2">What happens next?</div>
        <div className="text-sm text-[#666] leading-relaxed">1. Ship your return within 7 days<br/>2. We&apos;ll email you when we receive it<br/>3. Your <strong>$124.95 store credit</strong> will be issued within 3–5 business days</div>
      </div>
      <a href="https://missfinchnyc.com" className="inline-block mt-6 text-sm text-[#777] underline underline-offset-2">Continue shopping</a>
    </div></>);
}

export default function ReturnsPortal() {
  const [step, setStep] = useState(0);
  switch (step) {
    case 0: return <Login onLogin={()=>setStep(1)} />;
    case 1: return <OrderDetails onStart={()=>setStep(2)} />;
    case 2: return <SelectItems onContinue={()=>setStep(3)} onBack={()=>setStep(1)} />;
    case 3: return <ReturnReasons onContinue={()=>setStep(4)} onBack={()=>setStep(2)} />;
    case 4: return <ReturnMethod onContinue={()=>setStep(5)} onBack={()=>setStep(3)} />;
    case 5: return <ReviewSubmit onSubmit={()=>setStep(6)} onBack={()=>setStep(4)} />;
    case 6: return <Confirmation />;
    default: return <Login onLogin={()=>setStep(1)} />;
  }
}
