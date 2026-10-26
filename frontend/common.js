const $=s=>document.querySelector(s);
// ---- Static-hosting API layer (works on Vercel, no backend/MySQL needed) ----
const _json=async(url,opts)=>{
  const r=await fetch(url,opts);
  if(!r.ok)throw new Error(`Request failed (${r.status})`);
  return r.json();
};
const _geocode=async(q,opts={})=>{
  q=q.trim();
  if(q.length<2)return [];
  try{
    const d=await _json("https://geocoding-api.open-meteo.com/v1/search?"+new URLSearchParams({name:q,count:6,language:"en"}),opts);
    if(d.results&&d.results.length)return d.results.map(x=>({name:x.name,admin:x.admin1||"",country:x.country||"",lat:x.latitude,lon:x.longitude}));
  }catch(e){if(e.name==="AbortError")throw e}
  const d=await _json("https://photon.komoot.io/api/?"+new URLSearchParams({q,limit:6}),opts);
  return (d.features||[]).map(f=>{
    const p=f.properties||{},c=(f.geometry||{}).coordinates;
    const name=p.name||p.city||p.state;
    if(!name||!Array.isArray(c)||c.length<2)return null;
    return {name,admin:p.state||p.county||"",country:p.country||"",lat:c[1],lon:c[0]};
  }).filter(Boolean);
};
const _weather=(lat,lon,units)=>{
  const imp=units==="imperial";
  return _json("https://api.open-meteo.com/v1/forecast?"+new URLSearchParams({
    latitude:lat,longitude:lon,timezone:"auto",forecast_days:7,forecast_hours:24,
    current:"temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,is_day",
    hourly:"precipitation_probability,temperature_2m",
    daily:"weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,uv_index_max,sunrise,sunset",
    temperature_unit:imp?"fahrenheit":"celsius",wind_speed_unit:imp?"mph":"kmh",precipitation_unit:imp?"inch":"mm"
  }));
};
// Saved places live in this browser's localStorage instead of MySQL.
const _savedGet=()=>{try{return JSON.parse(localStorage.getItem("saved_places")||"[]")}catch(e){return []}};
const _savedSet=list=>{localStorage.setItem("saved_places",JSON.stringify(list));return list};
const api=async(u,o={})=>{
  const url=new URL(u,location.origin),method=(o.method||"GET").toUpperCase();
  if(url.pathname==="/api/geocode")return _geocode(url.searchParams.get("q")||"",{signal:o.signal});
  if(url.pathname==="/api/weather")return _weather(url.searchParams.get("lat"),url.searchParams.get("lon"),url.searchParams.get("units"));
  if(url.pathname==="/api/locations"){
    if(method==="POST"){
      const b=JSON.parse(o.body),list=_savedGet();
      if(!list.some(p=>Math.abs(p.latitude-b.latitude)<1e-4&&Math.abs(p.longitude-b.longitude)<1e-4))
        list.unshift({id:Date.now(),name:b.name,country:b.country,latitude:b.latitude,longitude:b.longitude});
      return _savedSet(list);
    }
    return _savedGet();
  }
  const del=url.pathname.match(/^\/api\/locations\/(\d+)$/);
  if(del&&method==="DELETE")return _savedSet(_savedGet().filter(p=>String(p.id)!==del[1]));
  // everything else (map page) still goes to a backend if one exists
  const r=await fetch(u,o);
  if(!r.ok)throw new Error((await r.json().catch(()=>({}))).detail||r.statusText||`Request failed (${r.status})`);
  return r.json();
};
const shared={units:localStorage.getItem("units")==="imperial"?"imperial":"metric",
  loc:JSON.parse(localStorage.getItem("loc")||'{"name":"Marikina City","admin":"","country":"Philippines","lat":14.6507,"lon":121.1029}')};
const setLoc=l=>{shared.loc=l;localStorage.setItem("loc",JSON.stringify(l))};
const U=()=>shared.units==="imperial"?{t:"°F",w:"mph",p:"in"}:{t:"°C",w:"km/h",p:"mm"};
function bindUnits(cb){
  const select=$("#units"),buttons=[...document.querySelectorAll(".unit-button")];
  const update=unit=>{
    shared.units=unit;localStorage.setItem("units",unit);
    if(select)select.value=unit;
    buttons.forEach(button=>{
      const active=button.dataset.unit===unit;
      button.classList.toggle("is-selected",active);
      button.setAttribute("aria-pressed",String(active));
    });
    cb&&cb();
  };
  if(select){select.value=shared.units;select.onchange=()=>update(select.value)}
  buttons.forEach(button=>{
    const active=button.dataset.unit===shared.units;
    button.classList.toggle("is-selected",active);
    button.setAttribute("aria-pressed",String(active));
    button.addEventListener("click",()=>update(button.dataset.unit));
  });
}
function bindSearch(onPick){
  const form=$("#search"),input=$("#q"),results=$("#results");
  if(!form||!input||!results)return;
  let timer=0,requestId=0,controller=null;
  const showMessage=text=>{results.replaceChildren();const message=document.createElement("p");
    message.className="search-message";message.textContent=text;results.append(message)};
  const selectLocation=location=>{
    results.replaceChildren();
    input.value="";
    input.setAttribute("aria-expanded","false");
    input.removeAttribute("aria-activedescendant");
    setLoc(location);
    onPick(location);
  };
  const search=async(q,selectFirst=false)=>{
    const id=++requestId;
    if(controller)controller.abort();
    controller=new AbortController();
    showMessage("Searching cities and countries…");
    try{
      const matches=await api("/api/geocode?q="+encodeURIComponent(q),{signal:controller.signal});
      if(id!==requestId)return;
      if(selectFirst&&matches.length){
        selectLocation(matches[0]);
        return;
      }
      results.replaceChildren();
      if(!matches.length){
        showMessage(`No locations found for “${q}”. Try a city, region, or country.`);
        input.setAttribute("aria-expanded","true");
        return;
      }
      matches.forEach((location,index)=>{
        const option=document.createElement("button");option.type="button";
        option.className="list-group-item search-result";option.setAttribute("role","option");
        option.id=`${input.id}-option-${index}`;
        option.setAttribute("aria-selected","false");
        option.tabIndex=-1;
        option.textContent=[...new Set([location.name,location.admin,location.country].filter(Boolean))].join(", ");
        option.dataset.location=JSON.stringify(location);
        option.addEventListener("click",()=>selectLocation(location));
        results.append(option);
      });
      input.setAttribute("aria-expanded","true");
    }catch(error){
      if(error.name!=="AbortError"&&id===requestId){
        showMessage(`Location search failed: ${error.message}`);
        input.setAttribute("aria-expanded","true");
      }
    }
  };
  form.onsubmit=e=>{
    e.preventDefault();
    clearTimeout(timer);
    const query=input.value.trim();
    if(query.length<2){
      showMessage("Enter at least 2 characters to search.");
      input.setAttribute("aria-expanded","true");
      return;
    }
    const options=results.querySelectorAll(".search-result");
    if(options.length){
      const active=results.querySelector('[aria-selected="true"]')||options[0];
      selectLocation(JSON.parse(active.dataset.location));
      return;
    }
    search(query,true);
  };
  input.addEventListener("input",()=>{
    clearTimeout(timer);
    ++requestId;
    if(controller)controller.abort();
    const query=input.value.trim();
    if(query.length<2){
      results.replaceChildren();
      input.setAttribute("aria-expanded","false");
      input.removeAttribute("aria-activedescendant");
      return;
    }
    showMessage("Searching cities and countries…");
    input.setAttribute("aria-expanded","true");
    timer=setTimeout(()=>search(query),300);
  });
  input.addEventListener("keydown",event=>{
    const options=[...results.querySelectorAll(".search-result")];
    if(event.key==="ArrowDown"||event.key==="ArrowUp"){
      if(!options.length)return;
      event.preventDefault();
      const current=options.findIndex(option=>option.getAttribute("aria-selected")==="true");
      const next=event.key==="ArrowDown"
        ? (current+1)%options.length
        : (current<=0?options.length-1:current-1);
      options.forEach((option,index)=>{
        const selected=index===next;
        option.setAttribute("aria-selected",String(selected));
        option.tabIndex=selected?0:-1;
      });
      input.setAttribute("aria-activedescendant",options[next].id);
    }
    if(event.key==="Enter"&&options.length){
      event.preventDefault();
      const active=results.querySelector('[aria-selected="true"]')||options[0];
      selectLocation(JSON.parse(active.dataset.location));
      return;
    }
    if(event.key==="Escape"){
      ++requestId;
      if(controller)controller.abort();
      results.replaceChildren();
      input.setAttribute("aria-expanded","false");
      input.removeAttribute("aria-activedescendant");
    }
  });
  document.addEventListener("click",event=>{
    if(!form.contains(event.target)&&!results.contains(event.target)){
      results.replaceChildren();
      input.setAttribute("aria-expanded","false");
      input.removeAttribute("aria-activedescendant");
    }
  });
}
