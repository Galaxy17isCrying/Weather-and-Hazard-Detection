const $=s=>document.querySelector(s);
const api=async(u,o)=>{const r=await fetch(u,o);if(!r.ok)throw new Error((await r.json().catch(()=>({}))).detail||r.statusText);return r.json()};
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
