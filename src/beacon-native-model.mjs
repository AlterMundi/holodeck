const path = key=>({'@path':'/'+key});
const intent = (name,context)=>({event:{name,context}});
const localAction = (id,kind,value)=>intent('stationInput',{id,kind,...(value===undefined?{}:{value})});

function segments(pointer){
  if(typeof pointer!=='string'||!pointer.startsWith('/'))return null;
  if(pointer==='/')return [];
  const parts=pointer.slice(1).split('/').map(part=>part.replaceAll('~1','/').replaceAll('~0','~'));
  return parts.some(part=>['__proto__','constructor','prototype'].includes(part))?null:parts;
}

function get(model,pointer){
  const parts=segments(pointer);
  if(!parts)return;
  return parts.reduce((item,part)=>item&&Object.hasOwn(item,part)?item[part]:undefined,model);
}

function put(model,pointer,value){
  const parts=segments(pointer);
  if(!parts?.length)return;
  const last=parts.pop();
  const owner=parts.reduce((item,part)=>item&&Object.hasOwn(item,part)?item[part]:undefined,model);
  if(owner&&typeof owner==='object')owner[last]=value;
}

function resolve(value,model){
  if(Array.isArray(value))return value.map(x=>resolve(x,model));
  if(value&&typeof value==='object'){
    if(Object.hasOwn(value,'@path'))return get(model,value['@path']);
    return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,resolve(item,model)]));
  }
  return value;
}

function bindings(value,paths=new Set()){
  if(!value||typeof value!=='object')return paths;
  if(typeof value['@path']==='string'&&segments(value['@path']))paths.add(value['@path']);
  else for(const entry of Object.values(value))bindings(entry,paths);
  return paths;
}

function containsBinding(binding,pointer){
  return binding==='/'||binding===pointer||pointer.startsWith(binding+'/');
}

function draftGuard(event,paths,pointer,data){
  if(![...paths].some(path=>containsBinding(path,pointer)))return;
  const authority=[...paths].filter(path=>!containsBinding(path,pointer)).map(path=>get(data,path));
  return JSON.stringify([event.name,event.context,authority]);
}

const weaverWorktable = [
  {id:'mix',label:'Mezcla',members:['preset','fundamental','master','actions','audio','output_gain','apply_output','voice_gains']},
  {id:'performance',label:'Interpretación',members:['performance_controls','experience_marks']},
  {id:'tracking',label:'Seguimiento',members:['body','live_calibration','recording_status','video_transport','live_tracking']},
  {id:'timbre',label:'Timbre por voz',members:['voice_timbre_title','voice_timbre_tabs']},
  {id:'response',label:'Respuesta al movimiento',members:['movement_response_title','movement_response_tabs']},
  {id:'model',label:'Modelo de movimiento',members:['algorithm_title','algorithm_tabs']},
  {id:'routing',label:'Señales y ruteos',members:['voice_routes_title','voice_route_tabs']},
  {id:'presets',label:'Presets',members:['preset_library']},
];

function weaverAreas(root){
  const children=root?.children;
  if(!Array.isArray(children))return [];
  const areas=weaverWorktable.map(({id,label,members})=>({
    id,label,children:children.filter(child=>members.includes(child)),
  })).filter(area=>area.children.length);
  // Scoped editors use a different root and keep their own navigation.
  if(areas.length<2)return [];
  const other=children.filter(child=>!areas.some(area=>area.children.includes(child)));
  if(other.length)areas.push({id:'other',label:'Otros controles',children:other});
  return areas;
}

export class BeaconNativeModel {
  constructor(surface){
    this.surface=surface;
    this.nodes=new Map();
    this.input=new Map();
    this.tabs=new Map();
    this.drafts=new Map();
    this.actionConflict=false;
    this.data={};
    this.page=0;
    this.weaverArea=undefined;
  }

  receive(messages){
    for(const message of messages){
      if(message?.version!=='1.0')continue;
      const initial=message.createSurface;
      if(initial?.surfaceId===this.surface){
        if(initial.dataModel?.sessionId!==this.data.sessionId)this.weaverArea=undefined;
        this.nodes.clear();
        this.drafts.clear();
        this.actionConflict=false;
        this.tabs.clear();
        this.page=0;
        this.data=structuredClone(initial.dataModel??{});
        this.components(initial.components);
      }
      const components=message.updateComponents;
      if(components?.surfaceId===this.surface)this.components(components.components);
      const model=message.updateDataModel;
      if(model?.surfaceId===this.surface){
        const before=structuredClone(this.data);
        if(model.path==='/')this.data=structuredClone(model.value??{});
        else put(this.data,model.path,structuredClone(model.value));
        for(const [pointer,draft] of this.drafts){
          const observed=JSON.stringify(get(this.data,pointer));
          if(observed===JSON.stringify(get(before,pointer)))continue;
          if(observed===JSON.stringify(draft.value))this.drafts.delete(pointer);
          else draft.invalid=true;
        }
      }
    }
  }

  components(nodes=[]){
    for(const node of nodes){
      if(typeof node?.id==='string')this.nodes.set(node.id,node);
    }
  }

  action(id,kind,value){
    this.actionConflict=false;
    if(kind==='page'){
      if(Number.isInteger(value)&&value>=0)this.page=value;
      return;
    }
    const input=this.input.get(id);
    if(!input||input.kind!==kind)return;
    if(kind==='area'){
      if(input.options.includes(value)&&value!==this.weaverArea){
        this.weaverArea=value;
        this.page=0;
      }
      return;
    }
    if(kind==='tab'){
      if(input.options.includes(value)){
        if(input.fixed&&this.tabs.get(id)!==value)this.page=0;
        this.tabs.set(id,value);
      }
      return;
    }
    if(kind==='button'){
      const event=input.node.action?.event;
      if(typeof event?.name!=='string')return;
      const paths=bindings(event.context);
      const changes=[];
      for(const [pointer,draft] of this.drafts){
        const expected=draftGuard(event,paths,pointer,this.data);
        if(expected===undefined)continue;
        if(draft.invalid||draft.guards.get(id)!==expected){
          this.actionConflict=true;
          this.drafts.delete(pointer);
        }else changes.push([pointer,draft.value]);
      }
      if(this.actionConflict)return;
      const data=structuredClone(this.data);
      for(const [pointer,value] of changes)put(data,pointer,value);
      return {version:'1.0',action:{name:event.name,surfaceId:this.surface,sourceComponentId:id,
        timestamp:new Date().toISOString(),context:resolve(event.context??{},data)}};
    }
    if(kind==='check'){
      const draft=this.drafts.get(input.pointer);
      const prior=draft&&!draft.invalid?draft.value:get(this.data,input.pointer);
      value=!prior;
    }
    if(kind==='choice'){
      if(!input.options.includes(value))return;
      value=[value];
    }
    if(kind==='number'){
      if(typeof value!=='string'||!value.trim()||!Number.isFinite(Number(value)))return;
      value=Number(value);
    }
    if((kind==='range'&&!Number.isFinite(value))||(kind==='text'&&typeof value!=='string'))return;
    const guards=new Map();
    for(const [buttonId,node] of this.nodes){
      const event=node.component==='Button'&&node.action?.event;
      if(!event)continue;
      const guard=draftGuard(event,bindings(event.context),input.pointer,this.data);
      if(guard!==undefined)guards.set(buttonId,guard);
    }
    this.drafts.set(input.pointer,{value,guards,invalid:false});
  }

  render(title){
    const rows=[];
    const navigation=[];
    const data={};
    const areas=this.surface==='weaver'?weaverAreas(this.nodes.get('root')):[];
    const area=areas.find(item=>item.id===this.weaverArea)??areas[0];
    if(area)this.weaverArea=area.id;
    const gestureKey=JSON.stringify([this.data.sessionId,this.data.stream,this.data.revision,this.data.profileVersion]);
    this.input.clear();
    if(area){
      const id='weaver_area';
      const options=areas.map(({id,label})=>({id,label}));
      data.selectedArea=data.areaDraft=area.id;
      this.input.set(id,{kind:'area',options:options.map(item=>item.id)});
      navigation.push({id,component:'HudChoice',label:'Área de Weaver',options,value:path('selectedArea'),
        draft:path('areaDraft'),action:localAction(id,'area',path('areaDraft'))});
    }
    const text=(id,label,style='body')=>({id,component:'HudText',label:String(label??''),style});
    const visit=(id,ancestors=new Set())=>{
      if(ancestors.has(id)||ancestors.size>=24||rows.length>=512)return;
      const node=this.nodes.get(id);
      if(!node||resolve(node.visible,this.data)===false)return;
      if(area&&node.component==='Text'&&node.text===area.label)return;
      const nested=new Set(ancestors).add(id);
      if(['Column','Row','Card'].includes(node.component)){
        for(const child of node.children??(node.child?[node.child]:[]))visit(child,nested);
        return;
      }
      const label=String(resolve(node.label,this.data)??'');
      const pointer=node.value?.['@path'];
      const draft=this.drafts.get(pointer);
      const shown=draft&&!draft.invalid?draft.value:resolve(node.value,this.data);
      const number=rows.length+navigation.length;
      const modelKey='value'+number;
      const draftKey='draft'+number;
      const field={id,label,value:path(modelKey),draft:path(draftKey)};
      const input=(kind,fields={})=>this.input.set(id,{kind,pointer,...fields});
      if(node.component==='Text')rows.push(text(id,resolve(node.text,this.data)));
      else if(node.component==='Button'){
        const child=this.nodes.get(node.child);
        const button=String(resolve(child?.text,this.data)??label);
        const disabled=(node['@checks']??[]).some(check=>resolve(check.condition,this.data)!==true);
        if(!disabled)input('button',{node});
        rows.push({id,component:'HudButton',label:button,disabled,action:localAction(id,'button')});
      }else if(node.component==='Slider'&&segments(pointer)?.length&&Number.isFinite(shown)){
        const min=resolve(node.min,this.data),max=resolve(node.max,this.data),steps=resolve(node.steps,this.data);
        if(!Number.isFinite(min)||!Number.isFinite(max)||max<=min) return;
        data[modelKey]=data[draftKey]=shown;
        input('range');
        rows.push({...field,component:'HudRange',min,max,step:(max-min)/(steps||100),gestureKey,
          ...(node.presentation==='fader'||/fader|ganancia|\bgain\b|volumen/i.test(label)?{presentation:'fader'}:{}),
          action:localAction(id,'range',path(draftKey))});
      }else if(node.component==='TextField'&&segments(pointer)?.length){
        const kind=node.variant==='number'?'number':'text';
        data[modelKey]=data[draftKey]=String(shown??'');
        input(kind);
        rows.push({...field,component:'HudTextInput',maxLength:100,action:localAction(id,kind,path(draftKey))});
      }else if(node.component==='CheckBox'&&segments(pointer)?.length){
        input('check');
        rows.push({id,component:'HudButton',label,pressed:shown===true,action:localAction(id,'check')});
      }else if(node.component==='ChoicePicker'&&segments(pointer)?.length&&node.variant==='mutuallyExclusive'){
        const options=(resolve(node.options,this.data)??[]).filter(item=>typeof item.value==='string')
          .map(item=>({id:item.value,label:String(item.label??item.value)}));
        if(!options.length)return;
        data[modelKey]=data[draftKey]=shown?.[0]??'';
        input('choice',{options:options.map(item=>item.id)});
        rows.push({...field,component:'HudChoice',options,action:localAction(id,'choice',path(draftKey))});
      }else if(node.component==='Tabs'&&Array.isArray(node.tabs)&&node.tabs.length){
        const options=node.tabs.filter(tab=>typeof tab.child==='string')
          .map(tab=>({id:tab.child,label:String(resolve(tab.title,this.data))}));
        if(!options.length)return;
        const selected=options.find(option=>option.id===this.tabs.get(id))?.id??options[0].id;
        data[modelKey]=data[draftKey]=selected;
        const fixed=area?.children.includes(id)??false;
        input('tab',{options:options.map(item=>item.id),fixed});
        (fixed?navigation:rows).push({...field,label:'Sección',component:'HudChoice',options,
                                      action:localAction(id,'tab',path(draftKey))});
        visit(selected,nested);
      }
    };
    if(area)for(const id of area.children)visit(id);
    else visit('root');
    const pages=[[]], pageSize=Math.max(2,7-navigation.length);
    for(let index=0;index<rows.length;index++){
      const row=rows[index],next=rows[index+1],pointer=this.input.get(row.id)?.pointer;
      const nextEvent=next?.component==='HudButton'&&this.input.get(next.id)?.node?.action?.event;
      const pair=pointer&&nextEvent&&[...bindings(nextEvent.context)].some(path=>containsBinding(path,pointer));
      if(pages.at(-1).length+(pair?2:1)>pageSize)pages.push([]);
      pages.at(-1).push(row);
      if(pair)pages.at(-1).push(rows[++index]);
    }
    const maxPage=pages.length-1;
    this.page=Math.min(this.page,maxPage);
    const shown=pages[this.page];
    const visible=[...navigation,...shown];
    const retained=new Set(visible.map(row=>row.id));
    for(const id of this.input.keys())if(!retained.has(id))this.input.delete(id);
    const header=text('station_title',title,'title');
    const components=[header,...visible];
    if(maxPage){
      for(const [name,label,step] of [['back','Anterior',-1],['next','Siguiente',1]]){
        const page=this.page+step;
        components.push({id:'station_'+name,component:'HudButton',label,disabled:page<0||page>maxPage,
                         action:localAction('station_pages','page',page)});
      }
      components.push({id:'station_pages',component:'HudRow',children:['station_back','station_next']});
    }
    return {data,components:[{id:'root',component:'HudPanel',width:2.65,
      children:[header.id,...visible.map(row=>row.id),...(maxPage?['station_pages']:[])]},...components]};
  }
}
