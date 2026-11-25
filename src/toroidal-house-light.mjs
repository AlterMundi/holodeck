import {Color,PointLight,Vector3} from 'three';

const nightFill=new Color(0xa4b8e4);
// Front plinth of the packaged facade, in its glTF local metres.
const porchPoint=new Vector3(0,1.02,1.55);

export function bindToroidalHouseLight(composer,group,document){
  const practical=new PointLight(0xffb86e,0,5.4,2);
  practical.name='Atelier porch light';
  practical.visible=false;
  group.add(practical);
  const sourceColor=new Color(),world=new Vector3();
  let baseline=null,model=null;
  function restore(){
    if(baseline){
      const {ambient,intensity,environment}=baseline;
      // A scoped room config can replace the light before the next frame.
      if(ambient===composer.ambientLight){
        ambient.intensity=intensity;
        ambient.color.copy(sourceColor);
      }
      composer.scene.environmentIntensity=composer.envValues?.envMapIntensity??environment;
      baseline=null;
    }
    practical.visible=false;
    practical.intensity=0;
    model=null;
  }

  return {
    update(solar){
      if(!solar){if(baseline||model)restore();return;}
      const ambient=composer.ambientLight;
      if(!ambient)return;
      if(baseline?.ambient!==ambient){
        baseline={ambient,intensity:ambient.intensity,
          environment:composer.envValues?.envMapIntensity??baseline?.environment??composer.scene.environmentIntensity};
        sourceColor.copy(ambient.color);
      }
      const day=solar.daylight;
      ambient.intensity=baseline.intensity*(.32+.68*day);
      ambient.color.copy(sourceColor).lerp(nightFill,1-day);
      const sky=composer.envValues?.envMapIntensity??baseline.environment;
      composer.scene.environmentIntensity=sky*(.25+.75*day);

      if(!model?.isConnected)model=document.querySelector('#ring-house m-model[id^="facade-"]');
      const packaged=/\/compaii-atelier-facade\.glb(?:[?#]|$)/.test(model?.getAttribute('src')??'');
      const house=packaged&&model?.modelGraphics?.hasLoadedModel()?model.getContainer():null;
      if(house){
        world.copy(porchPoint);
        house.localToWorld(world);
        group.worldToLocal(world);
        practical.position.copy(world);
      }
      practical.visible=!!house;
      practical.intensity=house?7.5*(1-day):0;
    },
    dispose(){
      restore();
      practical.removeFromParent();
      practical.dispose();
    },
  };
}
