/** Visibility comes from current server authorization, never a browser role claim. */
export function OpsEntryLink({allowed}:{allowed:boolean}){return allowed?<a className="secondary-link" href="/help-centre/ops">OPS Internal</a>:null;}
