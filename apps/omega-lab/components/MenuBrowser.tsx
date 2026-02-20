'use client';
import { useState } from 'react';
import menuData from '../data/mcdonalds-knowledge.json';

const S7 = (id: string) => `${menuData.image_base}${id}${menuData.image_params}`;
const FE: Record<string,string> = { burger:'🍔',chicken:'🍗',nugget:'🍗',fish:'🐟',fries:'🍟',drink:'🥤',coffee:'☕',pie:'🥧',cookie:'🍪',mcflurry:'🍦',tea:'🍵',sundae:'🍦',egg:'🥚',sausage:'🍳',hash:'🥟',hotcake:'🥞',burrito:'🌯',cone:'🍦',apple:'🍎',water:'💧',milk:'🥛',shake:'🥤',wrap:'🌯',smoothie:'🥤',bagel:'🥯',biscuit:'🧁',lemonade:'🍋',honey:'🍯',strip:'🍗',sauce:'🫙',ketchup:'🟥',mustard:'🟡',mayo:'⬜',default:'🍔' };
function ef(name:string){const n=name.toLowerCase();for(const[k,e]of Object.entries(FE)){if(n.includes(k))return e;}return FE.default;}
function Img({src,alt,className}:{src:string;alt:string;className?:string}){
  const[f,sF]=useState(false);
  if(f||!src) return <span className={className} style={{display:'flex',alignItems:'center',justifyContent:'center',fontSize:'3rem'}}>{ef(alt)}</span>;
  return <img className={className} src={src} alt={alt} onError={()=>sF(true)} draggable={false} style={{objectFit:'contain',width:'100%',height:'100%'}}/>;
}
interface MItem { id:string;name:string;description?:string;price?:number;meal_price?:number|null;prices?:Record<string,number>;calories?:number|Record<string,number>;allergens?:string[];customizable?:string[];default_ingredients?:string[];sauce_choices?:string[];includes?:string[];note?:string;flavors?:string[];section?:string;tags?:string[];img:string; }
interface MCat { id:string;label:string;img:string;items:MItem[]; }
function dP(i:MItem,sz?:string){if(i.prices&&sz&&i.prices[sz]!=null)return`$${i.prices[sz].toFixed(2)}`;if(i.prices){const v=Object.values(i.prices)[0];return`$${v.toFixed(2)}+`;}if(i.price!=null)return`$${i.price.toFixed(2)}`;return'';}
function dC(i:MItem,sz?:string){if(typeof i.calories==='object'&&sz&&i.calories[sz]!=null)return`${i.calories[sz]} Cal`;if(typeof i.calories==='object'){const v=Object.values(i.calories);return`${v[0]}–${v[v.length-1]} Cal`;}if(typeof i.calories==='number')return`${i.calories} Cal`;return'';}

function buildCats(tabId: string): MCat[] {
  const tab = (menuData.tabs as any[]).find((t: any) => t.id === tabId);
  if (!tab) return [];
  return tab.categories.map((cat: any) => ({
    id: cat.id,
    label: cat.label,
    img: cat.nav_image,
    items: cat.items.map((item: any) => {
      const { image, ...rest } = item;
      return { ...rest, img: S7(image) } as MItem;
    }),
  }));
}

const DAY_CATS: MCat[] = buildCats('dayMenu');
const BRK_CATS: MCat[] = buildCats('breakfast');

const TAB_MAP: Record<string, MCat[]> = { breakfast: BRK_CATS, dayMenu: DAY_CATS };

export function MenuBrowser() {
  const [topTab, setTopTab] = useState<'breakfast'|'dayMenu'>('dayMenu');
  const cats = TAB_MAP[topTab];
  const [activeCat, setActiveCat] = useState(cats[0].id);
  const [selectedItem, setSelectedItem] = useState<MItem|null>(null);
  const [selectedSize, setSelectedSize] = useState<string|null>(null);

  const switchTop = (tab: 'breakfast'|'dayMenu') => {
    setTopTab(tab);
    setActiveCat(TAB_MAP[tab][0].id);
    setSelectedItem(null); setSelectedSize(null);
  };
  const cat = cats.find(c => c.id === activeCat) || cats[0];
  const handleItemClick = (item: MItem) => {
    setSelectedItem(item);
    if (item.prices) {
      const sizes = Object.keys(item.prices);
      setSelectedSize(sizes.includes('medium') ? 'medium' : sizes[0]);
    } else { setSelectedSize(null); }
  };
  const handleBack = () => { setSelectedItem(null); setSelectedSize(null); };

  return (
    <div className="mb-root" suppressHydrationWarning>
      <div className="mb-top-tabs">
        <button className={`mb-top-tab ${topTab === 'breakfast' ? 'active' : ''}`} onClick={() => switchTop('breakfast')}>
          <span className="mb-top-icon">☀️</span><span>Breakfast</span>
        </button>
        <button className={`mb-top-tab ${topTab === 'dayMenu' ? 'active' : ''}`} onClick={() => switchTop('dayMenu')}>
          <span className="mb-top-icon">🍔</span><span>Lunch & Dinner</span>
        </button>
      </div>
      <div className="mb-body">
        <div className="mb-sidebar">
          {cats.map(c => (
            <button key={c.id} className={`mb-side-btn ${activeCat === c.id ? 'active' : ''}`}
              onClick={() => { setActiveCat(c.id); setSelectedItem(null); setSelectedSize(null); }}>
              <div className="mb-side-img-wrap"><Img src={c.img} alt={c.label} className="mb-side-img" /></div>
              <span className="mb-side-label">{c.label}</span>
            </button>
          ))}
        </div>
        <div className="mb-content">
          {selectedItem ? (
            <div className="mb-detail">
              <button className="mb-detail-back" onClick={handleBack}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                Back to {cat.label}
              </button>
              <div className="mb-detail-hero">
                <div className="mb-detail-img-wrap"><Img src={selectedItem.img} alt={selectedItem.name} className="mb-detail-img" /></div>
                <div className="mb-detail-info">
                  <h2 className="mb-detail-name">{selectedItem.name}</h2>
                  {selectedItem.description && <p className="mb-detail-desc">{selectedItem.description}</p>}
                  {selectedItem.prices && (
                    <div className="mb-sizes">
                      <span className="mb-sizes-label">Size</span>
                      <div className="mb-size-pills">
                        {Object.entries(selectedItem.prices).map(([sz, pr]) => (
                          <button key={sz} className={`mb-size-pill ${selectedSize === sz ? 'active' : ''}`} onClick={() => setSelectedSize(sz)}>
                            <span className="mb-size-name">{sz.charAt(0).toUpperCase()+sz.slice(1)}</span>
                            <span className="mb-size-price">${(pr as number).toFixed(2)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="mb-detail-price-row">
                    <span className="mb-detail-price">{dP(selectedItem, selectedSize||undefined)}</span>
                    {selectedItem.meal_price && <span className="mb-detail-meal">Meal: ${selectedItem.meal_price.toFixed(2)}</span>}
                  </div>
                  {selectedItem.calories && <div className="mb-detail-cal">{dC(selectedItem, selectedSize||undefined)}</div>}
                </div>
              </div>
              <div className="mb-detail-sections">
                {selectedItem.default_ingredients && selectedItem.default_ingredients.length > 0 && (
                  <div className="mb-detail-sec"><h4>Ingredients</h4><div className="mb-chips">{selectedItem.default_ingredients.map((x,i) => <span key={i} className="mb-chip">{x}</span>)}</div></div>
                )}
                {selectedItem.customizable && selectedItem.customizable.length > 0 && (
                  <div className="mb-detail-sec"><h4>Customize</h4><div className="mb-chips">{selectedItem.customizable.map((x,i) => <span key={i} className="mb-chip cust">{x}</span>)}</div></div>
                )}
                {selectedItem.sauce_choices && selectedItem.sauce_choices.length > 0 && (
                  <div className="mb-detail-sec"><h4>Dipping Sauces</h4><div className="mb-chips">{selectedItem.sauce_choices.map((x,i) => <span key={i} className="mb-chip sauce">{x}</span>)}</div></div>
                )}
                {selectedItem.flavors && selectedItem.flavors.length > 0 && (
                  <div className="mb-detail-sec"><h4>Flavors</h4><div className="mb-chips">{selectedItem.flavors.map((x,i) => <span key={i} className="mb-chip flavor">{x}</span>)}</div></div>
                )}
                {selectedItem.includes && selectedItem.includes.length > 0 && (
                  <div className="mb-detail-sec"><h4>Includes</h4><ul className="mb-detail-list">{selectedItem.includes.map((x,i) => <li key={i}>{x}</li>)}</ul></div>
                )}
                {selectedItem.allergens && selectedItem.allergens.length > 0 && (
                  <div className="mb-detail-sec"><h4>Allergens</h4><div className="mb-chips">{selectedItem.allergens.map((x,i) => <span key={i} className="mb-chip allergen">{x}</span>)}</div></div>
                )}
                {selectedItem.note && <div className="mb-detail-note">ℹ️ {selectedItem.note}</div>}
              </div>
            </div>
          ) : (
            <div className="mb-grid-wrap">
              <h3 className="mb-cat-title">{cat.label}</h3>
              {(() => {
                const sections: { section: string; items: MItem[] }[] = [];
                for (const item of cat.items) {
                  const sec = item.section || '';
                  const last = sections[sections.length - 1];
                  if (last && last.section === sec) { last.items.push(item); }
                  else { sections.push({ section: sec, items: [item] }); }
                }
                return sections.map((group, gi) => (
                  <div key={gi}>
                    {group.section && <h4 className="mb-section-title">{group.section}</h4>}
                    <div className="mb-grid">
                      {group.items.map(item => (
                        <button key={item.id} className="mb-card" onClick={() => handleItemClick(item)}>
                          <div className="mb-card-img-wrap"><Img src={item.img} alt={item.name} className="mb-card-img" /></div>
                          <div className="mb-card-body">
                            <span className="mb-card-name">{item.name}</span>
                            <span className="mb-card-price">{dP(item)}</span>
                            {item.calories && <span className="mb-card-cal">{dC(item)}</span>}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      </div>
      <style>{`
        .mb-root { display:flex; flex-direction:column; height:100%; overflow:hidden; background:#27251F; }
        .mb-top-tabs { display:flex; flex-shrink:0; justify-content:center; gap:8px; padding:10px 24px; background:linear-gradient(180deg,#1a1816,#201e1a); border-bottom:1px solid rgba(255,199,44,0.12); }
        .mb-top-tab {
          display:flex; align-items:center; justify-content:center; gap:8px;
          padding:10px 32px; background:transparent; border:none; border-bottom:3px solid transparent;
          border-radius:10px 10px 0 0;
          color:rgba(255,255,255,0.4); font-family:inherit; font-size:17px; font-weight:700;
          letter-spacing:0.5px; text-transform:uppercase; cursor:pointer; transition:all 0.2s;
        }
        .mb-top-tab:hover { color:rgba(255,255,255,0.7); background:rgba(255,255,255,0.03); }
        .mb-top-tab.active { color:#FFC72C; border-bottom-color:#FFC72C; background:rgba(255,199,44,0.05); }
        .mb-top-icon { font-size:18px; }
        .mb-body { display:flex; flex:1; overflow:hidden; }

        .mb-sidebar {
          width:240px; flex-shrink:0; display:flex; flex-direction:column; gap:2px;
          padding:16px 12px; overflow-y:auto; background:rgba(0,0,0,0.3);
          border-right:1px solid rgba(255,199,44,0.06);
        }
        .mb-sidebar::-webkit-scrollbar { width:5px; }
        .mb-sidebar::-webkit-scrollbar-thumb { background:rgba(255,199,44,0.15); border-radius:3px; }
        .mb-side-btn {
          display:flex; align-items:center; gap:14px;
          padding:12px 14px; border-radius:14px; background:transparent; border:1px solid transparent;
          color:rgba(255,255,255,0.55); font-family:inherit; cursor:pointer; transition:all 0.2s;
          text-align:left;
        }
        .mb-side-btn:hover { color:rgba(255,255,255,0.9); background:rgba(255,255,255,0.07); }
        .mb-side-btn.active { color:#FFC72C; background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.15); }
        .mb-side-img-wrap { width:72px; height:72px; border-radius:12px; overflow:hidden; background:transparent; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .mb-side-btn.active .mb-side-img-wrap { background:transparent; box-shadow:none; }
        .mb-side-img { width:100%; height:100%; object-fit:cover; }
        .mb-side-label { font-size:15px; font-weight:700; line-height:1.3; }

        .mb-content { flex:1; overflow-y:auto; overflow-x:hidden; }
        .mb-content::-webkit-scrollbar { width:5px; }
        .mb-content::-webkit-scrollbar-track { background:transparent; }
        .mb-content::-webkit-scrollbar-thumb { background:rgba(255,199,44,0.15); border-radius:3px; }

        .mb-grid-wrap { padding:24px 28px 40px; }
        .mb-cat-title { font-size:24px; font-weight:800; color:#FFC72C; margin:0 0 20px; padding-bottom:12px; border-bottom:2px solid rgba(255,199,44,0.15); }
        .mb-section-title { font-size:16px; font-weight:700; color:rgba(255,255,255,0.7); margin:24px 0 12px; padding:8px 14px; border-left:3px solid #FFC72C; background:rgba(255,199,44,0.04); border-radius:0 8px 8px 0; letter-spacing:0.3px; }
        .mb-section-title:first-child { margin-top:0; }
        .mb-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:12px; }

        .mb-card {
          display:flex; flex-direction:column; align-items:center; background:transparent;
          border:none; border-radius:14px; padding:20px 12px 22px;
          cursor:pointer; transition:all 0.15s; text-align:center; font-family:inherit; color:inherit;
        }
        .mb-card:hover { background:rgba(255,255,255,0.04); transform:translateY(-2px); }
        .mb-card-img-wrap {
          width:180px; height:180px; display:flex; align-items:center; justify-content:center;
          margin-bottom:14px;
        }
        .mb-card-img { max-width:170px; max-height:170px; width:auto; height:auto; filter:drop-shadow(0 4px 16px rgba(0,0,0,0.4)); }
        .mb-card-body { display:flex; flex-direction:column; gap:3px; padding:0 6px; }
        .mb-card-name { font-size:15px; font-weight:700; color:rgba(255,255,255,0.9); line-height:1.3; }
        .mb-card-price { font-size:18px; font-weight:800; color:#FFC72C; font-variant-numeric:tabular-nums; margin-top:3px; }
        .mb-card-cal { font-size:12px; color:rgba(255,255,255,0.35); }

        .mb-detail { padding:20px 28px 40px; animation:mb-in 0.25s ease-out; }
        @keyframes mb-in { from{opacity:0;transform:translateX(20px)} to{opacity:1;transform:translateX(0)} }
        .mb-detail-back {
          display:inline-flex; align-items:center; gap:6px; padding:8px 16px; border-radius:8px;
          background:rgba(255,199,44,0.08); border:1px solid rgba(255,199,44,0.15);
          color:#FFC72C; font-family:inherit; font-size:13px; font-weight:600; cursor:pointer; transition:all 0.15s; margin-bottom:20px;
        }
        .mb-detail-back:hover { background:rgba(255,199,44,0.15); }
        .mb-detail-hero { display:flex; gap:28px; align-items:flex-start; margin-bottom:28px; }
        .mb-detail-img-wrap { width:220px; height:220px; flex-shrink:0; display:flex; align-items:center; justify-content:center; background:transparent; border-radius:18px; border:none; padding:16px; }
        .mb-detail-img { max-width:200px; max-height:200px; width:auto; height:auto; }
        .mb-detail-info { flex:1; min-width:0; }
        .mb-detail-name { font-size:26px; font-weight:800; color:#fff; margin:0 0 10px; line-height:1.2; }
        .mb-detail-desc { font-size:14px; color:rgba(255,255,255,0.55); line-height:1.6; margin:0 0 16px; }
        .mb-sizes { margin-bottom:16px; }
        .mb-sizes-label { display:block; font-size:11px; font-weight:700; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:1px; margin-bottom:8px; }
        .mb-size-pills { display:flex; gap:10px; flex-wrap:wrap; }
        .mb-size-pill {
          display:flex; flex-direction:column; align-items:center; gap:3px; padding:12px 22px; border-radius:12px;
          background:rgba(255,255,255,0.04); border:2px solid rgba(255,199,44,0.1);
          color:rgba(255,255,255,0.6); font-family:inherit; cursor:pointer; transition:all 0.2s;
        }
        .mb-size-pill:hover { border-color:rgba(255,199,44,0.3); }
        .mb-size-pill.active { border-color:#FFC72C; background:rgba(255,199,44,0.1); color:#fff; box-shadow:0 0 12px rgba(255,199,44,0.12); }
        .mb-size-name { font-size:14px; font-weight:700; }
        .mb-size-price { font-size:13px; font-weight:600; color:#FFC72C; }
        .mb-detail-price-row { display:flex; align-items:baseline; gap:14px; margin-bottom:6px; }
        .mb-detail-price { font-size:30px; font-weight:800; color:#FFC72C; font-variant-numeric:tabular-nums; }
        .mb-detail-meal { font-size:14px; font-weight:600; color:rgba(255,255,255,0.4); background:rgba(218,41,28,0.12); padding:4px 12px; border-radius:6px; border:1px solid rgba(218,41,28,0.18); }
        .mb-detail-cal { font-size:13px; color:rgba(255,255,255,0.35); margin-bottom:6px; }
        .mb-detail-sections { display:flex; flex-direction:column; gap:18px; }
        .mb-detail-sec h4 { font-size:12px; font-weight:700; color:rgba(255,255,255,0.4); text-transform:uppercase; letter-spacing:1px; margin:0 0 8px; }
        .mb-chips { display:flex; flex-wrap:wrap; gap:6px; }
        .mb-chip { padding:6px 14px; border-radius:20px; font-size:12px; font-weight:500; background:rgba(255,255,255,0.05); color:rgba(255,255,255,0.65); border:1px solid rgba(255,255,255,0.07); }
        .mb-chip.cust { background:rgba(255,199,44,0.06); border-color:rgba(255,199,44,0.1); color:#FFC72C; }
        .mb-chip.sauce { background:rgba(218,41,28,0.07); border-color:rgba(218,41,28,0.12); color:#ff7b73; }
        .mb-chip.flavor { background:rgba(99,102,241,0.07); border-color:rgba(99,102,241,0.12); color:#a5b4fc; }
        .mb-chip.allergen { background:rgba(234,179,8,0.07); border-color:rgba(234,179,8,0.12); color:#fbbf24; font-weight:600; text-transform:uppercase; font-size:11px; letter-spacing:0.5px; }
        .mb-detail-list { margin:0; padding:0 0 0 20px; color:rgba(255,255,255,0.55); font-size:13px; line-height:1.8; }
        .mb-detail-list li::marker { color:#FFC72C; }
        .mb-detail-note { font-size:12px; color:rgba(255,255,255,0.35); padding:10px 14px; border-radius:8px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.04); line-height:1.5; }
      `}</style>
    </div>
  );
}
