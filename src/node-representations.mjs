// A bounded packaged model catalogue, not creator URLs, uploads or executable
// MML. New assets require ordinary qualified engine maintenance; existing
// presets can be selected/changed by native creators without another deployment.
export const NODE_REPRESENTATIONS=Object.freeze({
 'footballer-10':Object.freeze({asset:'footballer-10.glb',height:1.65})
});
export const validNodeRepresentation=value=>typeof value==='string'&&Object.hasOwn(NODE_REPRESENTATIONS,value);
export const nodeRepresentation=value=>validNodeRepresentation(value)?NODE_REPRESENTATIONS[value]:null;
export function pickedRepresentationVisit(record,state){
 const node=state?.nodes?.[record?.target];
 return node&&!node.deleted&&!node.play&&validNodeRepresentation(node.representation)
  &&record.run===state.run&&record.edition===state.edition&&record.revision===node.revision
  ?{id:record.target,revision:record.revision}:null;
}
