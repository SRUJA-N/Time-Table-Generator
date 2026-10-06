
const D=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const S={days:[...D],periods:[],sems:["2","4","6","8"],section:"A",teachers:[],subjects:[],rooms:[],semSubjects:[],labs:[],availability:{},locks:[],breaks:{},schedule:[],selected:"2"};
const $=x=>document.getElementById(x), esc=x=>String(x??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;"), uid=()=>Math.random().toString(36).slice(2);
const teacherName=t=>typeof t==="string"?t:String(t?.name||"");
const tOpts=v=>'<option value="">-- Select --</option>'+S.teachers.map(teacherName).filter(Boolean).map(name=>`<option value="${esc(name)}" ${name===v?"selected":""}>${esc(name)}</option>`).join("");
const rOpts=(type,v)=>'<option value="">-- Select room --</option>'+S.rooms.filter(r=>r.name&&(r.type===type||r.type==="Any")).map(r=>`<option value="${esc(r.name)}" ${r.name===v?"selected":""}>${esc(r.name)}</option>`).join("");
const sOpts=v=>'<option value="">-- Select --</option>'+S.subjects.filter(s=>s.name).map(s=>`<option ${s.name===v?"selected":""}>${esc(s.name)}</option>`).join("");

const STORAGE_KEY="smart-timetable-studio-v3-1-progress";
const pageState={master:["teachers","subjects","rooms"],sem:["sems","semRoom","semSubjects","days","periods","breaks"],labs:["labs"],rules:["locks"],tt:["schedule","selected"]};
let saveTimer=null;
function snapshot(){
  return {
    version:"3.1",
    savedAt:new Date().toISOString(),
    days:S.days,periods:S.periods,sems:S.sems,teachers:S.teachers,subjects:S.subjects,rooms:S.rooms,
    semSubjects:S.semSubjects,semRoom:S.semRoom||{},labs:S.labs,availability:S.availability,locks:S.locks,
    breaks:S.breaks,schedule:S.schedule,selected:S.selected,section:S.section||"A"
  };
}
function persist(show=true){
  try{
    localStorage.setItem(STORAGE_KEY,JSON.stringify(snapshot()));
    if(show){$("autosaveStatus").textContent="✓ Progress saved in this browser • "+new Date().toLocaleTimeString();}
  }catch(e){$("autosaveStatus").textContent="Could not save browser progress.";console.error(e)}
}
function saveProgress(page){
  persist(true);
  const b=document.querySelector(`#${page} .page-head button`);
  if(b){const old=b.textContent;b.textContent="✓ Saved";setTimeout(()=>b.textContent=old,1200)}
}
function restoreProgress(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw)return false;
    const x=JSON.parse(raw);
    if(!x||x.version!=="3.1")return false;
    Object.assign(S,x);
    if(!S.days?.length)S.days=[...D];
    if(!S.periods?.length)S.periods=[];
    if(!S.sems?.length)S.sems=["2"];
    S.semRoom??={};S.labs??=[];S.semSubjects??=[];S.breaks??={};S.locks??=[];S.schedule??=[];
    S.section=S.section||"A";
    S.schedule=S.schedule.filter(x=>x&&x.Day&&x.Period);
    S.schedule.forEach(x=>{x.Semester=String(x.Semester);x.Section=x.Section||S.section;x.Batch=x.Batch||"Whole Class";});
    const hasOddSampleData=S.semSubjects.some(x=>["1","3","5","7"].includes(String(x.sem)));
    const isPreviousBuiltInSample=S.teachers.length===12&&S.teachers.every((t,i)=>t.name===`T${i+1}`)
      &&S.subjects.some(x=>x.name==="Mathematics");
    if(!hasOddSampleData&&isPreviousBuiltInSample){
      loadSampleData(false);
      return true;
    }
    $("sems").value=S.sems.join(",");
    $("sectionSelect").value=S.section;
    $("pc").value=S.periods.length||8;
    $("autosaveStatus").textContent="✓ Previous progress restored • "+new Date(x.savedAt).toLocaleString();
    return true;
  }catch(e){console.warn("No valid saved progress",e);return false}
}
function clearBrowserProgress(){
  if(!confirm("Clear all saved browser progress and reset the project?"))return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}
function scheduleAutosave(){
  clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>persist(false),350);
}
function wireAutosave(){
  document.addEventListener("input",scheduleAutosave,true);
  document.addEventListener("change",scheduleAutosave,true);
  document.addEventListener("click",e=>{
    if(e.target.closest("button,select"))setTimeout(()=>persist(false),80);
  },true);
}

function loadSampleData(force=false){
  if(force&&!confirm("Replace current setup with complete sample data (teachers, rooms, subjects, labs)?"))return;
  S.days=["Monday","Tuesday","Wednesday","Thursday","Friday"];
  S.sems=["2","4","6","8"];
  S.section="A";
  S.selected="2";
  S.locks=[];
  S.schedule=[];
  S.availability={};
  S.teachers=["T1","T2","T3","T4","T5","T6","T7","T8","T9","T10","T11","T12",
    "T13","T14","T15","T16","T17","T18","T19","T20","T21","T22","T23","T24"
  ].map(name=>({name,max:"",unavailable:""}));
  S.rooms=[
    {name:"Room 101",type:"Theory",capacity:60},{name:"Room 102",type:"Theory",capacity:60},
    {name:"Room 103",type:"Theory",capacity:60},{name:"Room 104",type:"Theory",capacity:60},
    {name:"Lab 1",type:"Lab",capacity:30},{name:"Lab 2",type:"Lab",capacity:30},{name:"Lab 3",type:"Lab",capacity:30},
    {name:"Lab 4",type:"Lab",capacity:30},{name:"Lab 5",type:"Lab",capacity:30},{name:"Lab 6",type:"Lab",capacity:30},
    {name:"Room 105",type:"Theory",capacity:60},{name:"Room 106",type:"Theory",capacity:60},
    {name:"Room 107",type:"Theory",capacity:60},{name:"Room 108",type:"Theory",capacity:60},
    {name:"Lab 7",type:"Lab",capacity:30},{name:"Lab 8",type:"Lab",capacity:30},{name:"Lab 9",type:"Lab",capacity:30},
    {name:"Lab 10",type:"Lab",capacity:30},{name:"Lab 11",type:"Lab",capacity:30},{name:"Lab 12",type:"Lab",capacity:30}
  ];
  S.subjects=[
    {name:"Mathematics",type:"Theory",teacher:"T1"},{name:"Data Structures",type:"Theory",teacher:"T2"},
    {name:"Digital Logic",type:"Theory",teacher:"T3"},{name:"Programming Lab",type:"Lab",teacher:"T1"},
    {name:"DS Lab",type:"Lab",teacher:"T2"},{name:"Digital Lab",type:"Lab",teacher:"T3"},
    {name:"Operating Systems",type:"Theory",teacher:"T4"},{name:"DBMS",type:"Theory",teacher:"T5"},
    {name:"Computer Networks",type:"Theory",teacher:"T6"},{name:"OS Lab",type:"Lab",teacher:"T4"},
    {name:"DBMS Lab",type:"Lab",teacher:"T5"},{name:"CN Lab",type:"Lab",teacher:"T6"},
    {name:"Software Engineering",type:"Theory",teacher:"T7"},{name:"Web Technology",type:"Theory",teacher:"T8"},
    {name:"Compiler Design",type:"Theory",teacher:"T9"},{name:"SE Lab",type:"Lab",teacher:"T7"},
    {name:"Web Lab",type:"Lab",teacher:"T8"},{name:"Compiler Lab",type:"Lab",teacher:"T9"},
    {name:"Machine Learning",type:"Theory",teacher:"T10"},{name:"Cloud Computing",type:"Theory",teacher:"T11"},
    {name:"Cyber Security",type:"Theory",teacher:"T12"},{name:"ML Lab",type:"Lab",teacher:"T10"},
    {name:"Cloud Lab",type:"Lab",teacher:"T11"},{name:"Security Lab",type:"Lab",teacher:"T12"},
    {name:"Engineering Mathematics",type:"Theory",teacher:"T13"},{name:"Physics",type:"Theory",teacher:"T14"},
    {name:"Basic Electrical",type:"Theory",teacher:"T15"},{name:"Engineering Physics Lab",type:"Lab",teacher:"T13"},
    {name:"Electrical Lab",type:"Lab",teacher:"T14"},{name:"Workshop Lab",type:"Lab",teacher:"T15"},
    {name:"Algorithms",type:"Theory",teacher:"T16"},{name:"Computer Organization",type:"Theory",teacher:"T17"},
    {name:"Probability and Statistics",type:"Theory",teacher:"T18"},{name:"Algorithms Lab",type:"Lab",teacher:"T16"},
    {name:"CO Lab",type:"Lab",teacher:"T17"},{name:"Statistics Lab",type:"Lab",teacher:"T18"},
    {name:"Artificial Intelligence",type:"Theory",teacher:"T19"},{name:"Advanced Databases",type:"Theory",teacher:"T20"},
    {name:"Distributed Systems",type:"Theory",teacher:"T21"},{name:"AI Lab",type:"Lab",teacher:"T19"},
    {name:"Database Lab",type:"Lab",teacher:"T20"},{name:"Distributed Systems Lab",type:"Lab",teacher:"T21"},
    {name:"Project Management",type:"Theory",teacher:"T22"},{name:"Big Data",type:"Theory",teacher:"T23"},
    {name:"Information Security",type:"Theory",teacher:"T24"},{name:"Big Data Lab",type:"Lab",teacher:"T22"},
    {name:"Security Practice Lab",type:"Lab",teacher:"T23"},{name:"Project Lab",type:"Lab",teacher:"T24"}
  ];
  S.semRoom={
    "2":{theory:["Room 101"],lab:["Lab 1","Lab 2","Lab 3"]},
    "4":{theory:["Room 102"],lab:["Lab 1","Lab 2","Lab 3"]},
    "6":{theory:["Room 103"],lab:["Lab 4","Lab 5","Lab 6"]},
    "8":{theory:["Room 104"],lab:["Lab 4","Lab 5","Lab 6"]},
    "1":{theory:["Room 105"],lab:["Lab 7","Lab 8","Lab 9"]},
    "3":{theory:["Room 106"],lab:["Lab 7","Lab 8","Lab 9"]},
    "5":{theory:["Room 107"],lab:["Lab 10","Lab 11","Lab 12"]},
    "7":{theory:["Room 108"],lab:["Lab 10","Lab 11","Lab 12"]}
  };
  const map=[
    ["2","Mathematics","Theory",4,"T1"],["2","Data Structures","Theory",3,"T2"],["2","Digital Logic","Theory",3,"T3"],
    ["2","Programming Lab","Lab",1,"T1"],["2","DS Lab","Lab",1,"T2"],["2","Digital Lab","Lab",1,"T3"],
    ["4","Operating Systems","Theory",4,"T4"],["4","DBMS","Theory",3,"T5"],["4","Computer Networks","Theory",3,"T6"],
    ["4","OS Lab","Lab",1,"T4"],["4","DBMS Lab","Lab",1,"T5"],["4","CN Lab","Lab",1,"T6"],
    ["6","Software Engineering","Theory",4,"T7"],["6","Web Technology","Theory",3,"T8"],["6","Compiler Design","Theory",3,"T9"],
    ["6","SE Lab","Lab",1,"T7"],["6","Web Lab","Lab",1,"T8"],["6","Compiler Lab","Lab",1,"T9"],
    ["8","Machine Learning","Theory",4,"T10"],["8","Cloud Computing","Theory",3,"T11"],["8","Cyber Security","Theory",3,"T12"],
    ["8","ML Lab","Lab",1,"T10"],["8","Cloud Lab","Lab",1,"T11"],["8","Security Lab","Lab",1,"T12"],
    ["1","Engineering Mathematics","Theory",4,"T13"],["1","Physics","Theory",3,"T14"],["1","Basic Electrical","Theory",3,"T15"],
    ["1","Engineering Physics Lab","Lab",1,"T13"],["1","Electrical Lab","Lab",1,"T14"],["1","Workshop Lab","Lab",1,"T15"],
    ["3","Algorithms","Theory",4,"T16"],["3","Computer Organization","Theory",3,"T17"],["3","Probability and Statistics","Theory",3,"T18"],
    ["3","Algorithms Lab","Lab",1,"T16"],["3","CO Lab","Lab",1,"T17"],["3","Statistics Lab","Lab",1,"T18"],
    ["5","Artificial Intelligence","Theory",4,"T19"],["5","Advanced Databases","Theory",3,"T20"],["5","Distributed Systems","Theory",3,"T21"],
    ["5","AI Lab","Lab",1,"T19"],["5","Database Lab","Lab",1,"T20"],["5","Distributed Systems Lab","Lab",1,"T21"],
    ["7","Project Management","Theory",4,"T22"],["7","Big Data","Theory",3,"T23"],["7","Information Security","Theory",3,"T24"],
    ["7","Big Data Lab","Lab",1,"T22"],["7","Security Practice Lab","Lab",1,"T23"],["7","Project Lab","Lab",1,"T24"]
  ];
  S.semSubjects=map.map(([sem,subject,type,sessions,main])=>({sem,subject,type,sessions,main}));
  const labRooms={
    "2":["Lab 1","Lab 2","Lab 3"],"4":["Lab 1","Lab 2","Lab 3"],"6":["Lab 4","Lab 5","Lab 6"],"8":["Lab 4","Lab 5","Lab 6"],
    "1":["Lab 7","Lab 8","Lab 9"],"3":["Lab 7","Lab 8","Lab 9"],"5":["Lab 10","Lab 11","Lab 12"],"7":["Lab 10","Lab 11","Lab 12"]
  };
  const labMains={
    "2":["T1","T2","T3"],"4":["T4","T5","T6"],"6":["T7","T8","T9"],"8":["T10","T11","T12"],
    "1":["T13","T14","T15"],"3":["T16","T17","T18"],"5":["T19","T20","T21"],"7":["T22","T23","T24"]
  };
  S.labs=S.semSubjects.filter(x=>x.type==="Lab").map(x=>{
    const rooms=labRooms[x.sem]||["Lab 1","Lab 2","Lab 3"];
    const mains=labMains[x.sem]||[x.main,x.main,x.main];
    const labsInSem=S.semSubjects.filter(a=>a.sem===x.sem&&a.type==="Lab");
    const idx=labsInSem.indexOf(x);
    return {
      key:x.sem+"|"+x.subject,sem:x.sem,subject:x.subject,division:"3 Batches",main:x.main,duration:2,
      batches:[
        {name:"A1",main:mains[0],room:rooms[0]},
        {name:"A2",main:mains[1],room:rooms[1]},
        {name:"A3",main:mains[2],room:rooms[2]}
      ],
      _idx:idx
    };
  });
  // Rotate batch mains so each lab block uses three different teachers (A1/A2/A3).
  S.labs.forEach(l=>{
    const mains=labMains[l.sem]||[];
    const i=l._idx||0;
    l.batches=l.batches.map((b,bi)=>({...b,main:mains[(i+bi)%mains.length]||b.main}));
    delete l._idx;
  });
  $("pc").value=8;
  makePeriods();
  S.breaks={};
  for(const d of S.days)S.breaks[d+"|P5"]="Lunch";
  $("sems").value=S.sems.join(",");
  $("sectionSelect").value=S.section;
  if($("maxday"))$("maxday").value=6;
  if($("maxsub"))$("maxsub").value=1;
  if($("labdur"))$("labdur").value=2;
  renderAll();
  renderTT();
  persist(true);
  $("autosaveStatus").textContent="✓ Sample data loaded — open Timetable and click Generate.";
  $("status")&&($("status").textContent="Sample data ready. Click Generate.");
}

function init(){
  makePeriods();
  const restored=restoreProgress();
  const incomplete=!S.semSubjects?.length||!S.semRoom||!Object.keys(S.semRoom).length;
  if(!restored||incomplete)loadSampleData(false);
  else{renderAll();renderTT();}
  wireAutosave();
  $("clearLocal").onclick=clearBrowserProgress;
  $("sampleData").onclick=()=>loadSampleData(true);
  tabs();$("pc").onchange=makePeriods;$("sems").onchange=sync;$("sectionSelect").onchange=()=>{S.section=$("sectionSelect").value.trim()||"A";renderSemSubjects();scheduleAutosave();}; $("gen").onclick=generate;$("validate").onclick=()=>messages(validate());$("excel").onclick=excel;$("save").onclick=save;$("load").onclick=()=>$("file").click();$("file").onchange=load
}
function sync(){S.sems=$("sems").value.split(",").map(x=>x.trim()).filter(Boolean);if(!S.sems.length)S.sems=["2"];if(!S.sems.includes(S.selected))S.selected=S.sems[0];renderAll()}
function setSemPreset(type){S.sems=type==="odd"?["1","3","5","7"]:["2","4","6","8"];if(!S.sems.includes(S.selected))S.selected=S.sems[0];$("sems").value=S.sems.join(",");sync()}
function makePeriods(){let n=Math.max(1,Math.min(12,+$("pc").value||8));S.periods=[];for(let i=0;i<n;i++){let h=8+Math.floor(i/1);S.periods.push({id:"P"+(i+1),start:hm(h*60),end:hm(h*60+60)})}renderPeriods();renderBreaks()}
function hm(m){m=((m%1440)+1440)%1440;return String(Math.floor(m/60)).padStart(2,"0")+":"+String(m%60).padStart(2,"0")}
function shiftTime(p,k,delta){let a=p[k].split(":");p[k]=hm(+a[0]*60+ +a[1]+delta);renderPeriods()}
function renderPeriods(){$("periods").innerHTML=S.periods.map((p,i)=>`<div class="period"><b>${p.id}</b><label>Start<div class="time-row"><button onclick="shiftTime(S.periods[${i}],'start',-30)">−30</button><input value="${p.start}" onchange="S.periods[${i}].start=this.value"><button onclick="shiftTime(S.periods[${i}],'start',30)">+30</button></div></label><label>End<div class="time-row"><button onclick="shiftTime(S.periods[${i}],'end',-30)">−30</button><input value="${p.end}" onchange="S.periods[${i}].end=this.value"><button onclick="shiftTime(S.periods[${i}],'end',30)">+30</button></div></label></div>`).join("")}
function renderAll(){renderTeachers();renderSubjects();renderRooms();renderDays();renderPeriods();renderBreaks();renderSemRooms();renderSemSubjects();renderLabs();renderAvailability();renderLocks()}
function renderTeachers(){$("teachers").innerHTML=`<div class="table-scroll"><table class="data"><tr><th>Name</th><th></th></tr>${S.teachers.map((t,i)=>`<tr data-i="${i}"><td><input value="${esc(t.name)}" onchange="S.teachers[${i}].name=this.value.trim();renderAll()"></td><td><button onclick="S.teachers.splice(${i},1);renderAll()">✕</button></td></tr>`).join("")}</table></div><button onclick="S.teachers.push({name:''});renderAll()">＋ Add teacher</button>`}
function renderSubjects(){$("subjects").innerHTML=`<div class="table-scroll"><table class="data"><tr><th>Subject</th><th>Type</th><th>Default Main Teacher</th><th></th></tr>${S.subjects.map((s,i)=>`<tr><td><input value="${esc(s.name)}" onchange="S.subjects[${i}].name=this.value"></td><td><select onchange="S.subjects[${i}].type=this.value;renderAll()"><option ${s.type==="Theory"?"selected":""}>Theory</option><option ${s.type==="Lab"?"selected":""}>Lab</option></select></td><td><select onchange="S.subjects[${i}].teacher=this.value">${tOpts(s.teacher)}</select></td><td><button onclick="S.subjects.splice(${i},1);renderAll()">✕</button></td></tr>`).join("")}</table></div><button onclick="S.subjects.push({name:'',type:'Theory',teacher:''});renderAll()">＋ Add subject</button>`}
function renderRooms(){$("rooms").innerHTML=`<div class="table-scroll"><table class="data"><tr><th>Room/Lab</th><th>Type</th><th>Capacity</th><th></th></tr>${S.rooms.map((r,i)=>`<tr><td><input value="${esc(r.name)}" onchange="S.rooms[${i}].name=this.value"></td><td><select onchange="S.rooms[${i}].type=this.value"><option ${r.type==="Theory"?"selected":""}>Theory</option><option ${r.type==="Lab"?"selected":""}>Lab</option><option ${r.type==="Any"?"selected":""}>Any</option></select></td><td><input type="number" value="${r.capacity||''}" onchange="S.rooms[${i}].capacity=this.value"></td><td><button onclick="S.rooms.splice(${i},1);renderAll()">✕</button></td></tr>`).join("")}</table></div><button onclick="S.rooms.push({name:'',type:'Theory',capacity:60});renderAll()">＋ Add room/lab</button>`}
function renderDays(){$("days").innerHTML=D.map(d=>`<label class="check"><input type="checkbox" ${S.days.includes(d)?"checked":""} onchange="toggleDay('${d}',this.checked)"> ${d}</label>`).join("")}
function toggleDay(d,on){if(on&&!S.days.includes(d))S.days.push(d);if(!on)S.days=S.days.filter(x=>x!==d);renderBreaks();renderLocks()}
function renderBreaks(){$("breaks").innerHTML=`<div class="break-grid">${S.days.map(d=>`<div class="break-row"><b>${d}</b>${S.periods.map(p=>{let k=d+"|"+p.id;return `<button class="${S.breaks[k]?'active':''}" onclick="toggleBreak('${k}')">${esc(S.breaks[k]||p.id)}</button>`}).join("")}</div>`).join("")}</div>`}
function toggleBreak(k){if(S.breaks[k])delete S.breaks[k];else S.breaks[k]="Lunch";renderBreaks()}
function renderSemRooms(){
  S.semRoom??={};
  $("semRooms").innerHTML=S.sems.map(sem=>{
    let q=S.rooms.filter(r=>r.name);
    S.semRoom[sem]??={theory:[],lab:[]};
    let th=S.semRoom[sem].theory||[], lb=S.semRoom[sem].lab||[];
    let theory=q.filter(r=>r.type!=="Lab");
    let labs=q.filter(r=>r.type!=="Theory");
    // Keep the current fixed selections, but expose them as normal dropdowns.
    // Multiple fixed rooms are represented by several room slots.
    let theoryCount=Math.max(1,th.length||1), labCount=Math.max(1,lb.length||3);
    let theorySlots=Array.from({length:theoryCount},(_,i)=>`
      <label>Theory Room ${i+1}
        <select onchange="setSemRoomSlot('${sem}','theory',${i},this.value)">
          ${rOpts("Theory",th[i]||"")}
        </select>
      </label>`).join("");
    let labSlots=Array.from({length:labCount},(_,i)=>`
      <label>Lab Room ${i+1}
        <select onchange="setSemRoomSlot('${sem}','lab',${i},this.value)">
          ${rOpts("Lab",lb[i]||"")}
        </select>
      </label>`).join("");
    return `<div class="card">
      <h3>Semester ${esc(sem)} — fixed rooms</h3>
      <div class="info">Choose room numbers from dropdowns. These rooms are remembered for this semester and reused automatically.</div>
      <div class="grid two">
        <div><h4>Theory rooms</h4>${theorySlots}<button onclick="addSemRoomSlot('${sem}','theory')">＋ Add theory room</button></div>
        <div><h4>Lab rooms</h4>${labSlots}<button onclick="addSemRoomSlot('${sem}','lab')">＋ Add lab room</button></div>
      </div>
    </div>`;
  }).join("")
}
function setSemRoomSlot(sem,type,index,value){
  S.semRoom??={}; S.semRoom[sem]??={theory:[],lab:[]};
  let arr=S.semRoom[sem][type]||[];
  arr[index]=value;
  arr=arr.filter(Boolean);
  S.semRoom[sem][type]=arr;
  renderSemSubjects(); renderLabs();
}
function addSemRoomSlot(sem,type){
  S.semRoom??={}; S.semRoom[sem]??={theory:[],lab:[]};
  S.semRoom[sem][type]??=[];
  S.semRoom[sem][type].push("");
  renderSemRooms();
}
function setSemRooms(sem,k,v){S.semRoom??={};S.semRoom[sem]??={theory:[],lab:[]};S.semRoom[sem][k]=v;renderSemSubjects();renderLabs()}
function renderSemSubjects(){$("semSubjects").innerHTML=S.sems.map(sem=>`<div class="card"><h3>Semester ${esc(sem)} — Section ${esc(S.section)}</h3><div class="table-scroll"><table class="data"><tr><th>Subject</th><th>Type</th><th>Sessions/week</th><th>Main Teacher</th><th></th></tr>${S.semSubjects.filter(x=>String(x.sem)===String(sem)).map((x,i)=>{let ix=S.semSubjects.indexOf(x);let m=S.subjects.find(s=>s.name===x.subject);let assigned=teacherName(m?.teacher);if(!x.main&&assigned)x.main=assigned;return `<tr><td><select onchange="S.semSubjects[${ix}].subject=this.value;S.semSubjects[${ix}].type=(S.subjects.find(s=>s.name===this.value)||{}).type||'Theory';S.semSubjects[${ix}].main=teacherName(S.subjects.find(s=>s.name===this.value)?.teacher);renderSemSubjects();renderLabs()">${sOpts(x.subject)}</select></td><td>${esc(x.type)}</td><td><input type="number" min="1" value="${x.sessions}" onchange="S.semSubjects[${ix}].sessions=+this.value"></td><td><select aria-label="Main teacher for ${esc(x.subject)}" onchange="S.semSubjects[${ix}].main=this.value">${tOpts(x.main)}</select><small class="muted">Assigned: ${esc(x.main||"Not assigned")}</small></td><td><button onclick="S.semSubjects.splice(${ix},1);renderAll()">✕</button></td></tr>`}).join("")}</table></div><button onclick="S.semSubjects.push({sem:'${sem}',subject:'',type:'Theory',sessions:1,main:''});renderAll()">＋ Add subject</button></div>`).join("")}
function renderLabs(){let ls=S.semSubjects.filter(x=>x.type==="Lab"&&x.subject&&S.sems.includes(x.sem));$("labsList").innerHTML=ls.length?ls.map(x=>{let key=x.sem+"|"+x.subject;let l=S.labs.find(a=>a.key===key)||{key,sem:x.sem,subject:x.subject,division:"3 Batches",main:x.main,duration:+$("labdur").value||2,batches:[{name:"A1",main:"",room:""},{name:"A2",main:"",room:""},{name:"A3",main:"",room:""}]};if(!S.labs.find(a=>a.key===key))S.labs.push(l);let n=l.division==="3 Batches"?3:l.division==="2 Batches"?2:1;return `<div class="card"><h3>Semester ${esc(l.sem)} — ${esc(l.subject)}</h3><div class="grid three"><label>Division<select onchange="labSet('${key}','division',this.value)"><option ${l.division==="Entire Section"?"selected":""}>Entire Section</option><option ${l.division==="2 Batches"?"selected":""}>2 Batches</option><option ${l.division==="3 Batches"?"selected":""}>3 Batches</option></select></label><label>Main Teacher<select onchange="labSet('${key}','main',this.value)">${tOpts(l.main)}</select></label><label>Duration<div class="time-row"><button onclick="labSet('${key}','duration',Math.max(1,l.duration-1))">−</button><input value="${l.duration}" onchange="labSet('${key}','duration',Math.max(1,+this.value||1))"><button onclick="labSet('${key}','duration',Math.min(4,l.duration+1))">+</button></div></label></div><div class="info">Co-Teacher is <b>not manually entered</b>. The generator will choose a teacher who is free for all continuous periods of this lab session.</div><table class="data"><tr><th>Batch</th><th>Main Teacher</th><th>Fixed Lab Room</th></tr>${Array.from({length:n},(_,i)=>{let b=l.batches[i]||{name:"A"+(i+1),main:"",room:""};return `<tr><td><input value="${esc(b.name)}" onchange="labBatch('${key}',${i},'name',this.value)"></td><td><select onchange="labBatch('${key}',${i},'main',this.value)">${tOpts(b.main||l.main)}</select></td><td><select onchange="labBatch('${key}',${i},'room',this.value)">${rOpts("Lab",b.room)}</select></td></tr>`}).join("")}</table></div>`}).join(""):"<div class='empty'>Add Lab subjects in Semester Setup.</div>"}
function labSet(k,f,v){let l=S.labs.find(x=>x.key===k);if(l){l[f]=v;renderLabs()}}
function labBatch(k,i,f,v){let l=S.labs.find(x=>x.key===k);l.batches[i]??={name:"A"+(i+1),main:"",room:""};l.batches[i][f]=v}
function renderAvailability(){$("availability").innerHTML=`<table class="data"><tr><th>Teacher</th><th>Max/day</th><th>Unavailable</th></tr>${S.teachers.filter(t=>t.name).map((t,i)=>`<tr><td>${esc(t.name)}</td><td><input type="number" value="${t.max||''}" onchange="S.teachers[${i}].max=this.value"></td><td><input value="${esc(t.unavailable||'')}" onchange="S.teachers[${i}].unavailable=this.value"></td></tr>`).join("")}</table>`}
function renderLocks(){$("locks").innerHTML=`<table class="data"><tr><th>Semester</th><th>Day</th><th>Period</th><th>Subject optional</th><th></th></tr>${S.locks.map((l,i)=>`<tr><td><select onchange="S.locks[${i}].sem=this.value">${S.sems.map(s=>`<option ${s===l.sem?"selected":""}>${s}</option>`).join("")}</select></td><td><select onchange="S.locks[${i}].day=this.value">${S.days.map(d=>`<option ${d===l.day?"selected":""}>${d}</option>`).join("")}</select></td><td><select onchange="S.locks[${i}].period=this.value">${S.periods.map(p=>`<option ${p.id===l.period?"selected":""}>${p.id}</option>`).join("")}</select></td><td><input value="${esc(l.subject||'')}" onchange="S.locks[${i}].subject=this.value"></td><td><button onclick="S.locks.splice(${i},1);renderLocks()">✕</button></td></tr>`).join("")}</table><button onclick="S.locks.push({sem:S.sems[0],day:S.days[0],period:S.periods[0].id,subject:''});renderLocks()">＋ Add lock</button>`}
function unavailable(t,d,p){let x=S.teachers.find(a=>a.name===t);return x&&String(x.unavailable||"").split(";").map(a=>a.trim()).includes(d+"/"+p)}
function teacherBusy(t,d,p,arr=S.schedule){return !!t&&arr.some(x=>x.Day===d&&x.Period===p&&(x.MainTeacher===t||x.CoTeacher===t))}
function roomBusy(r,d,p,arr=S.schedule){return !!r&&arr.some(x=>x.Day===d&&x.Period===p&&x.Room===r)}
function secBusy(sem,d,p,arr=S.schedule){return arr.some(x=>x.Semester===sem&&x.Section===S.section&&x.Day===d&&x.Period===p)}
function blocked(sem,d,p,sub){return !!S.breaks[d+"|"+p]||S.locks.some(x=>x.sem===sem&&x.day===d&&x.period===p&&(!x.subject||x.subject===sub))}
function freeCo(main,d,ps,arr){for(let t of S.teachers.filter(x=>x.name&&x.name!==main)){if(ps.every(p=>!teacherBusy(t.name,d,p,arr)&&!unavailable(t.name,d,p)))return t.name}return ""}
function semesterTheoryRooms(sem){return (S.semRoom?.[sem]?.theory||[]).filter(Boolean)}
function semesterLabRooms(sem){return (S.semRoom?.[sem]?.lab||[]).filter(Boolean)}
function slotHasSemesterNonLab(sem,d,p,arr){return arr.some(x=>x.Semester===sem&&x.Section===S.section&&x.Day===d&&x.Period===p&&x.Type!=="Lab")}
async function generate() {
  const generateButton =
    document.getElementById("generateBtn") ||
    document.querySelector('button[onclick="generate()"]');

  const originalButtonText = generateButton?.textContent || "Generate";

  if (generateButton) {
    generateButton.disabled = true;
    generateButton.textContent = "Generating...";
  }
  try {
const semConfig = {};
const breakSlots = S.periods
  .map((p, i) => i + 1)
  .filter(n => S.days.some(d => S.breaks[d + "|P" + n]));
for (const sem of S.sems) {
  semConfig[sem] = { days: S.days, slots: S.periods.length, breakSlots };
}

const payload = {
  sems: S.sems,
  section: S.section,
  teachers: S.teachers,
  rooms: S.rooms,
  semSubjects: S.semSubjects,
  labs: S.labs,
  locks: S.locks,
  semRoom: S.semRoom,
  semConfig,
  rules: {
    maxTeacherPerDay: +$("maxday").value || 0,
    maxSubjectPerDay: +$("maxsub").value || 1,
  },
};

    const response = await fetch(
      "http://localhost:8000/generate-timetable",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      let errorMessage = "The backend could not generate a timetable.";

      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorMessage;
      } catch {
        // Use the default error message if the response is not valid JSON.
      }

      throw new Error(errorMessage);
    }

    const solvedSchedule = await response.json();

    if (!Array.isArray(solvedSchedule)) {
      throw new Error("The backend returned an invalid timetable.");
    }

    S.schedule = solvedSchedule;
    renderTT();
  } catch (error) {
    console.error("Timetable generation failed:", error);
    alert(
      error.message ||
        "Unable to generate the timetable. Please check the backend and try again."
    );
  } finally {
    if (generateButton) {
      generateButton.disabled = false;
      generateButton.textContent = originalButtonText;
    }
  }
}

function getConflicts(){
  const out=[];
  const groups=(arr,key)=>{
    const m={}; for(const x of arr){const k=key(x);(m[k]??=[]).push(x)}
    return Object.entries(m).filter(([,v])=>v.length>1).map(([key,items])=>({key,items}));
  };
  // Any role (main or co) counting as the same teacher being double-booked.
  const teacherSlots=[];
  for(const x of S.schedule){
    if(x.MainTeacher)teacherSlots.push({id:x.id,t:x.MainTeacher,Day:x.Day,Period:x.Period,role:"Main"});
    if(x.CoTeacher)teacherSlots.push({id:x.id,t:x.CoTeacher,Day:x.Day,Period:x.Period,role:"Co"});
  }
  for(const g of groups(teacherSlots,x=>`${x.t}|${x.Day}|${x.Period}`))
    g.items.forEach(x=>out.push({id:x.id,type:"teacher",text:`${x.role} teacher ${x.t} overlaps on ${x.Day} ${x.Period}`}));
  for(const g of groups(S.schedule.filter(x=>x.Room),x=>`${x.Room}|${x.Day}|${x.Period}`))
    g.items.forEach(x=>out.push({id:x.id,type:"room",text:`Room ${x.Room} overlaps on ${x.Day} ${x.Period}`}));
  // Lab batches may run simultaneously within the same section. Only non-lab classes
  // occupy the whole section, while each individual batch must not overlap itself.
  for(const g of groups(S.schedule.filter(x=>x.Type!=="Lab"),x=>`${x.Semester}|${x.Section}|${x.Day}|${x.Period}`))
    g.items.forEach(x=>out.push({id:x.id,type:"section",text:`Semester ${x.Semester} has overlapping classes on ${x.Day} ${x.Period}`}));
  for(const g of groups(S.schedule.filter(x=>x.Type==="Lab"),x=>`${x.Semester}|${x.Batch}|${x.Day}|${x.Period}`))
    g.items.forEach(x=>out.push({id:x.id,type:"batch",text:`Batch ${x.Batch} overlaps on ${x.Day} ${x.Period}`}));
  return [...new Map(out.map(x=>[x.id+"|"+x.type,x])).values()];
}
function validate(){return getConflicts().map(x=>x.text)}
function messages(a){
  $("messages").innerHTML=a.length?a.slice(0,50).map(x=>`<div class="msg error">⚠ ${esc(x)}</div>`).join(""):`<div class="msg ok">✓ No detected teacher, room, section or batch conflicts.</div>`;
}
function renderTT() {
  if (!S.schedule || S.schedule.length === 0) {
    $("table").innerHTML = "<p>No schedule generated yet.</p>";
    return;
  }

  // Find all unique semesters returned by the backend
  const uniqueSems = [...new Set(S.schedule.map(x => x.Semester))].sort();
  
  // If nothing is selected, default to the first semester
  if (!uniqueSems.includes(S.selected)) {
    S.selected = uniqueSems[0];
  }

  // Create the clickable semester tabs
  let h = `<div class="sem-tabs" style="margin-bottom: 20px;">
    ${uniqueSems.map(s => 
      `<button class="${s === S.selected ? 'active' : ''}" 
               style="padding: 10px 20px; font-weight: bold;" 
               onclick="S.selected='${s}';renderTT()">${s}</button>`
    ).join("")}
  </div>`;

  h += `<div class="ttwrap"><table class="tt"><tr><th>Day</th>${S.periods.map(p => `<th>${p.id}<small>${p.start}–${p.end}</small></th>`).join("")}</tr>`;

  for (const d of S.days) {
    h += `<tr><th>${d}</th>`;
    for (const p of S.periods) {
      const br = S.breaks[d + "|" + p.id];
      // Filter the global schedule down to just the selected semester, day, and period
      const xs = S.schedule.filter(x => x.Semester === S.selected && x.Day === d && x.Period === p.id);

      h += br ? `<td class="breakcell">${esc(br)}</td>` : `<td>${xs.map(x => 
        `<div class="item ${x.Type === "Lab" ? "lab" : ""}">
          <b>${esc(x.Subject)}</b>
          <small>${esc(x.Batch)}</small>
          <small>Main: ${esc(x.MainTeacher)}</small>${x.CoTeacher ? `<small>Co: ${esc(x.CoTeacher)}</small>` : ""}
          <small>🏫 ${esc(x.Room)}</small>
        </div>`).join("")}</td>`;
    }
    h += "</tr>";
  }
  
  $("table").innerHTML = h + "</table></div>";
}
function editSetup(){$("es").innerHTML=S.sems.map(s=>`<option>${s}</option>`).join("");$("ed").innerHTML=S.days.map(d=>`<option>${d}</option>`).join("");$("ep").innerHTML=S.periods.map(p=>`<option>${p.id}</option>`).join("");$("ea").onchange=editFields;editFields()}
function editFields(){if($("ea").value==="swap")$("edit").innerHTML=`<div class="grid three"><label>Other day<select id="sd">${S.days.map(d=>`<option>${d}</option>`).join("")}</select></label><label>Other period<select id="sp">${S.periods.map(p=>`<option>${p.id}</option>`).join("")}</select></label><button onclick="swap()">Swap</button></div>`;else $("edit").innerHTML=`<div class="grid two"><label>New value<input id="nv"></label><button onclick="editClass()">Save</button></div>`}
function chosen(){return S.schedule.find(x=>x.Semester===$("es").value&&x.Day===$("ed").value&&x.Period===$("ep").value)}
function swap(){let a=chosen(),b=S.schedule.find(x=>x.Semester===$("es").value&&x.Day===$("sd").value&&x.Period===$("sp").value);if(!a||!b)return alert("Both slots need classes.");[a.Day,a.Period,b.Day,b.Period]=[b.Day,b.Period,a.Day,a.Period];renderTT();messages(validate())}
function editClass(){let x=chosen(),v=$("nv").value.trim();if(!x||!v)return;let f=$("ea").value;x[f==="main"?"MainTeacher":f==="co"?"CoTeacher":"Room"]=v;renderTT();messages(validate())}
function renderReports(){let tm={};S.schedule.forEach(x=>{[x.MainTeacher,x.CoTeacher].filter(Boolean).forEach(t=>tm[t]=(tm[t]||0)+1)});$("metrics").innerHTML=[["Semesters",S.sems.length],["Subjects",S.subjects.length],["Teachers",S.teachers.filter(t=>t.name).length],["Rooms",S.rooms.filter(r=>r.name).length],["Lab rows",S.schedule.filter(x=>x.Type==="Lab").length],["Total rows",S.schedule.length]].map(a=>`<div class="card metric">${a[1]}<small>${a[0]}</small></div>`).join("");$("teacherReport").innerHTML="<table class=data><tr><th>Teacher</th><th>Assigned periods</th></tr>"+Object.entries(tm).sort((a,b)=>b[1]-a[1]).map(a=>`<tr><td>${esc(a[0])}</td><td>${a[1]}</td></tr>`).join("")+"</table>";$("coReport").innerHTML="<table class=data><tr><th>Semester</th><th>Lab</th><th>Day</th><th>Period</th><th>Batch</th><th>Main</th><th>Auto Co</th><th>Room</th></tr>"+S.schedule.filter(x=>x.Type==="Lab").map(x=>`<tr><td>${x.Semester}</td><td>${esc(x.Subject)}</td><td>${x.Day}</td><td>${x.Period}</td><td>${x.Batch}</td><td>${esc(x.MainTeacher)}</td><td>${esc(x.CoTeacher)}</td><td>${esc(x.Room)}</td></tr>`).join("")+"</table>"}
function excel(){if(!S.schedule.length)return alert("Generate first.");let wb=XLSX.utils.book_new(),rows=S.schedule.map(x=>({Semester:x.Semester,Section:x.Section,Day:x.Day,Period:x.Period,Batch:x.Batch,Subject:x.Subject,Type:x.Type,"Main Teacher":x.MainTeacher,"Co-Teacher":x.CoTeacher,Room:x.Room}));XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),"Master");for(let s of S.sems)XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows.filter(x=>x.Semester===s)),("Sem "+s+" "+S.section).slice(0,31));let tr=[];S.schedule.forEach(x=>{if(x.MainTeacher)tr.push({...x,Role:"Main",Teacher:x.MainTeacher});if(x.CoTeacher)tr.push({...x,Role:"Co",Teacher:x.CoTeacher})});XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(tr),"Teacher Timetable");XLSX.writeFile(wb,"smart-timetable-v3-1.xlsx")}
function save(){persist(true);let a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(S)],{type:"application/json"}));a.download="smart-timetable-v3-1-project.json";a.click()}
function load(e){let r=new FileReader;r.onload=()=>{Object.assign(S,JSON.parse(r.result));S.section=S.section||"A";$("sems").value=S.sems.join(",");$("sectionSelect").value=S.section;$("pc").value=S.periods.length;persist(false);renderAll();renderTT();$("autosaveStatus").textContent="✓ File loaded and saved to browser progress."};r.readAsText(e.target.files[0])}
function tabs(){document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>{document.querySelectorAll("nav button,.panel").forEach(x=>x.classList.remove("active"));b.classList.add("active");$(b.dataset.tab).classList.add("active");if(b.dataset.tab==="reports")renderReports()})}
init();
