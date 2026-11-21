"use strict";

// Keep the active Core flow ID across every step, including QR and provider verification.
async function stevoraFlow({base, initial, title, request, translate, finished}) {
  const dlg=document.createElement("dialog");
  dlg.className="details-dialog flow-dialog";
  const heading=document.createElement("h2");heading.textContent=title;
  const content=document.createElement("section");
  const error=document.createElement("p");error.setAttribute("role","alert");
  const cancel=document.createElement("button");cancel.textContent=translate("Отказ","Cancel");
  dlg.append(heading,content,error,cancel);
  document.body.append(dlg);dlg.showModal();
  let step=initial,timer,busy=false,complete=false;
  const endpoint=()=>base+"/"+encodeURIComponent(step.flow_id);
  dlg.addEventListener("close",()=>{
    clearTimeout(timer);dlg.remove();
    if(!complete && step.flow_id)request(endpoint(),"DELETE").catch(()=>{});
  });
  cancel.onclick=()=>dlg.close();
  async function advance(method,data){
    if(busy||!dlg.open)return;
    busy=true;content.inert=true;error.textContent="";
    try{
      const next=await request(endpoint(),method,data);
      if(dlg.open){step=next;await render();}
    }catch(e){error.textContent=e.message}
    finally{busy=false;content.inert=false;}
  }
  function button(text,action){const el=document.createElement("button");el.type="button";el.textContent=text;el.onclick=action;content.append(el);}
  function paragraph(text){const p=document.createElement("p");p.textContent=text;content.append(p);}
  async function render(){
    clearTimeout(timer);content.replaceChildren();
    if(step.type==="create_entry"||step.type==="abort"){
      complete=true;dlg.close();await finished(step);return;
    }
    if(!step.flow_id)throw new Error("Missing configuration flow");
    if(step.step_id)paragraph(step.step_id.replaceAll("_"," "));
    if(step.description)paragraph(step.description);
    for(const [k,v] of Object.entries(step.errors||{}))paragraph(k+" · "+v);
    for(const [k,v] of Object.entries(step.description_placeholders||{})){
      if(["msg","code","error","name"].includes(k))paragraph(String(v));
    }
    if(step.type==="menu"){
      for(const key of step.menu_options||[])button(key,()=>advance("POST",{next_step_id:key}));
      return;
    }
    if(step.type==="external"){
      const url=new URL(step.url);
      if(url.protocol!=="https:")throw new Error(translate("Невалиден адрес на доставчика","Invalid provider address"));
      const link=document.createElement("a");link.href=url.href;link.target="_blank";link.rel="noopener noreferrer";
      link.textContent=translate("Отвори доставчика","Open provider");content.append(link);
    }
    if(["external","progress","show_progress"].includes(step.type)){
      paragraph(translate("Изчакване на потвърждение","Waiting for confirmation"));
      timer=setTimeout(()=>advance("GET"),2500);
      button(translate("Провери","Check"),()=>advance("GET"));return;
    }
    if(["external_done","progress_done","show_progress_done"].includes(step.type)){
      button(translate("Продължи","Continue"),()=>advance("POST",{}));return;
    }
    if(step.type!=="form"){paragraph(translate("Неподдържана стъпка","Unsupported step")+" · "+step.type);return;}
    const form=document.createElement("form");content.append(form);
    const readers=[];
    for(const f of step.data_schema||[]){
      const selector=f.selector||{};
      if(selector.qr_code){
        const qr=qrcode(0,"Q");qr.addData(selector.qr_code.data);qr.make();
        const image=document.createElement("img");image.src=qr.createDataURL(5,20);
        image.alt=translate("QR код за потвърждение","Verification QR code");
        paragraph(translate("Сканирай с приложението на доставчика и потвърди.","Scan with the provider app, then confirm."));form.append(image);continue;
      }
      const label=document.createElement("label");label.textContent=f.name.replaceAll("_"," ");
      const choices=selector.select?.options||f.options;
      const list=Array.isArray(choices);
      const many=Boolean(selector.select?.multiple || f.type==="multi_select");
      const bool=f.type==="boolean"||"boolean" in selector;
      const number=["integer","float"].includes(f.type)||"number" in selector;
      const structured=["object","list","dict"].includes(f.type)||Object.keys(selector).some(k=>!["select","boolean","number","text","date","time"].includes(k));
      const input=document.createElement(list?"select":structured?"textarea":"input");
      if(list){
        input.multiple=many;
        if(!many && f.default==null)input.add(new Option("",""));
        for(const choice of choices){
          const [value,text]=Array.isArray(choice)?choice:typeof choice==="object"?[choice.value,choice.label]:[choice,choice];
          const option=new Option(text??value,value);input.add(option);
          option.selected=many?(f.default||[]).includes(value):String(f.default)===String(value);
        }
      }else if(!structured){
        const suggested=selector.text?.type;
        input.type=bool?"checkbox":number?"number":/pass(word|phrase)?|secret|token/i.test(f.name)?"password":
          ["email","password","url","tel"].includes(suggested)?suggested:"date" in selector?"date":"time" in selector?"time":"text";
        if(number){input.step=f.type==="integer"?"1":String(selector.number?.step||"any");for(const key of ["min","max"])if(selector.number?.[key]!=null)input[key]=selector.number[key];}
      }else{label.append(" (JSON)");}
      if(bool)input.checked=Boolean(f.default);
      else if(!list && f.default!=null)input.value=structured?JSON.stringify(f.default):String(f.default);
      input.required=Boolean(f.required)&&!bool;
      label.append(input);form.append(label);
      readers.push(data=>{
        if(!bool && !input.value && !f.required)return;
        data[f.name]=bool?input.checked:many&&list?Array.from(input.selectedOptions,o=>o.value):number?input.valueAsNumber:
          structured&&!list?JSON.parse(input.value):input.value;
      });
    }
    const submit=document.createElement("button");submit.textContent=translate("Потвърди","Confirm");submit.type="submit";form.append(submit);
    form.onsubmit=e=>{e.preventDefault();const data={};try{readers.forEach(read=>read(data));void advance("POST",data);}catch(err){error.textContent=err.message;}};
  }
  try{await render();}catch(e){error.textContent=e.message;}
}
