const {WopiActions } =require("./WopiDiscovery");

(async ()=>{
    const wopi = new WopiActions();
    const m = await wopi.getViewAction("docx");
    console.log(m)

    const wopi2 = new WopiActions();
    const m2 = await wopi2.getViewAction("xlsx");
    console.log(m2)
})()