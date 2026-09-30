/** Monotonic foreground timer. Large suspended-runtime gaps are bounded, not assumed reading. */
export class VisibleTimeClock {
 private total=0;
 private since:number|null=null;
 setVisible(visible:boolean,now:number){this.sample(now);this.since=visible?now:null;}
 sample(now:number){
  if(this.since!==null){this.total=Math.min(43200000,this.total+Math.max(0,Math.min(30000,now-this.since)));this.since=now;}
  return Math.floor(this.total);
 }
}
