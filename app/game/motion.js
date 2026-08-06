export function landingInstability(impactSpeed,horizontalSpeed){
  if(impactSpeed<6)return 0;
  return Math.min(.78,Math.max(0,(impactSpeed-6)*.075+horizontalSpeed*.032));
}

export function movementResponse(grounded,balancing){
  if(!grounded)return {acceleration:4.1,drag:.38,maxSpeed:5.55};
  if(balancing)return {acceleration:5.2,drag:2.2,maxSpeed:5.8};
  return {acceleration:15.5,drag:8.5,maxSpeed:7};
}
