declare module '#imports' {
 export function onMounted(fn:()=>void):void;
 export function onServerPrefetch(fn:()=>Promise<void>):void;
 export function useRequestFetch():<T>(url:string,options:unknown)=>Promise<T>;
 export function useState<T>(key:string,init:()=>T):{value:T};
}
declare function useRoute():{query:Record<string,unknown>};
