const weatherIcon=code=>{
  const [icon,label]=codeInfo(code);
  const supported={sun:"sun",part:"partly",cloud:"cloud",rain:"rain",snow:"cloud",storm:"rain",fog:"cloud"};
  return {icon:supported[icon]||"cloud",label};
};
const showTemp=value=>`${Math.round(value)}°${shared.units==="imperial"?"F":"C"}`;
const hourLabel=value=>{
  const hour=Number(value.slice(11,13));
  return `${hour%12||12}${hour<12?" AM":" PM"}`;
};
const localDateLabel=(value,options)=>{
  const date=new Date(`${value.slice(0,10)}T12:00:00Z`);
  return new Intl.DateTimeFormat("en",{...options,timeZone:"UTC"}).format(date);
};
const locationLabel=loc=>[...new Set([loc.name,loc.admin,loc.country].filter(Boolean))].join(", ");
let requestVersion=0;

function renderWeather(data,loc){
  const current=data.current,daily=data.daily;
  const condition=weatherIcon(current.weather_code);
  const title=locationLabel(loc);
  $("#place").textContent=title;
  const localClock=new Date(`${current.time.slice(0,10)}T${current.time.slice(11,16)}:00Z`);
  $("#local-time").textContent=`${localDateLabel(current.time,{weekday:"long",month:"long",day:"numeric"})} · ${new Intl.DateTimeFormat("en",{hour:"numeric",minute:"2-digit",timeZone:"UTC"}).format(localClock)} local time`;
  $("#current-temp").innerHTML=`${Math.round(current.temperature_2m)}<span>°</span><small class="hero-unit">${shared.units==="imperial"?"F":"C"}</small>`;
  $("#current-condition").textContent=condition.label;
  $("#today-high").textContent=showTemp(daily.temperature_2m_max[0]);
  $("#today-low").textContent=showTemp(daily.temperature_2m_min[0]);
  $("#hero-art").setAttribute("aria-label",`Pixel-art ${condition.label.toLowerCase()} weather`);
  const heroIcon=$("#hero-icon");
  heroIcon.className=`sprite sprite-${condition.icon}`;
  heroIcon.replaceChildren(window.WeatherUI.spriteMarkup(condition.icon));

  const uv=Math.round(daily.uv_index_max[0]);
  $("#uv-value").textContent=uv;
  $("#uv-category").textContent=uv<3?"Low":uv<6?"Moderate":uv<8?"High":uv<11?"Very high":"Extreme";
  $("#uv-meter-fill").style.width=`${Math.min(uv/11*100,100)}%`;
  $("#wind-value").textContent=Math.round(current.wind_speed_10m);
  $("#wind-unit").textContent=shared.units==="imperial"?"mph":"km/h";
  $("#wind-direction").textContent="—";
  $("#wind-arrow").textContent="";
  $("#humidity-value").textContent=current.relative_humidity_2m;
  $("#pressure-value").textContent="—";
  $("#visibility-value").textContent="—";

  const currentTime=current.time.slice(0,16);
  let firstHour=data.hourly.time.findIndex(time=>time>=currentTime);
  if(firstHour<0)firstHour=0;
  const hourly=$("#hourly-list");
  hourly.replaceChildren();
  data.hourly.time.slice(firstHour,firstHour+5).forEach((time,index)=>{
    const sourceIndex=firstHour+index;
    const chance=data.hourly.precipitation_probability[sourceIndex]||0;
    const icon=chance>55?"rain":chance<15?"sun":"partly";
    const button=document.createElement("button");
    button.type="button";
    button.className=`hour-card${index===0?" is-selected":""}`;
    button.setAttribute("aria-pressed",String(index===0));
    button.setAttribute("aria-label",`${index===0?"Now":hourLabel(time)}, ${showTemp(data.hourly.temperature_2m[sourceIndex])}, ${chance}% chance of rain`);
    const label=document.createElement("span");
    label.className="hour-time";
    label.textContent=index===0?"Now":hourLabel(time);
    const image=window.WeatherUI.makeWeatherSprite(icon);
    const temperature=document.createElement("span");
    temperature.className="hour-temp";
    temperature.textContent=showTemp(data.hourly.temperature_2m[sourceIndex]);
    button.append(label,image,temperature);
    button.addEventListener("click",()=>{
      hourly.querySelectorAll(".hour-card").forEach(card=>{
        const selected=card===button;
        card.classList.toggle("is-selected",selected);
        card.setAttribute("aria-pressed",String(selected));
      });
    });
    hourly.append(button);
  });

  const week=$("#week-list");
  week.replaceChildren();
  daily.time.forEach((date,index)=>{
    const info=weatherIcon(daily.weather_code[index]);
    const row=document.createElement("div");
    row.className="forecast-row";
    const day=document.createElement("span");
    day.className="forecast-day";
    day.textContent=index===0?"Today":localDateLabel(date,{weekday:"long"});
    const icon=document.createElement("span");
    icon.className="forecast-icon";
    icon.append(window.WeatherUI.makeWeatherSprite(info.icon,info.label));
    const temperatures=document.createElement("span");
    temperatures.className="forecast-temp";
    temperatures.textContent=`${showTemp(daily.temperature_2m_max[index])} / ${showTemp(daily.temperature_2m_min[index])}`;
    row.append(day,icon,temperatures);
    week.append(row);
  });
  $("#weather-message").textContent="";
}

async function showWeather(loc){
  const version=++requestVersion;
  $("#place").textContent=locationLabel(loc);
  $("#weather-message").textContent="Loading the local forecast…";
  try{
    const data=await api(`/api/weather?lat=${encodeURIComponent(loc.lat)}&lon=${encodeURIComponent(loc.lon)}&units=${shared.units}`);
    if(version!==requestVersion)return;
    renderWeather(data,loc);
  }catch(error){
    if(version!==requestVersion)return;
    $("#weather-message").textContent=`Weather could not be loaded: ${error.message}`;
    $("#current-condition").textContent="Forecast unavailable";
    $("#hourly-list").replaceChildren();
    $("#week-list").replaceChildren();
  }
}

let saved=[];
function renderSaved(){
  const list=$("#saved");
  $("#saved-count").textContent=saved.length;
  list.replaceChildren();
  if(!saved.length){
    const empty=document.createElement("li");
    empty.textContent="No saved places yet.";
    list.append(empty);
    return;
  }
  saved.forEach(place=>{
    const item=document.createElement("li");
    const select=document.createElement("button");
    select.type="button";
    select.textContent=[place.name,place.country].filter(Boolean).join(", ");
    select.addEventListener("click",()=>{
      const location={name:place.name,admin:"",country:place.country,lat:place.latitude,lon:place.longitude};
      setLoc(location);
      showWeather(location);
    });
    const remove=document.createElement("button");
    remove.type="button";
    remove.className="remove-saved";
    remove.textContent="Remove";
    remove.setAttribute("aria-label",`Remove ${place.name} from saved places`);
    remove.addEventListener("click",async()=>{
      try{
        saved=await api(`/api/locations/${place.id}`,{method:"DELETE"});
        renderSaved();
      }catch(error){$("#action-note").textContent=`Could not remove saved place: ${error.message}`}
    });
    item.append(select,remove);
    list.append(item);
  });
}

bindUnits(()=>showWeather(shared.loc));
bindSearch(showWeather);
$("#savebtn").addEventListener("click",async()=>{
  const loc=shared.loc;
  try{
    saved=await api("/api/locations",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({name:loc.name,country:loc.country||null,latitude:loc.lat,longitude:loc.lon})});
    renderSaved();
    $("#action-note").textContent="Location saved.";
  }catch(error){$("#action-note").textContent=`Could not save location: ${error.message}`}
});
(async()=>{
  showWeather(shared.loc);
  try{saved=await api("/api/locations");renderSaved()}
  catch(error){
    $("#saved").replaceChildren();
    const item=document.createElement("li");
    item.textContent=`Saved places unavailable: ${error.message}`;
    $("#saved").append(item);
  }
})();
