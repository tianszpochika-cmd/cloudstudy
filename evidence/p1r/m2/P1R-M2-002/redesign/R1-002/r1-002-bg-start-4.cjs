'use strict';
// Keep lifecycle ownership in the unified launcher; the caller retains this exec session.
const {spawn}=require('node:child_process');const path=require('node:path');
const target=process.argv.includes('--gateway')?'r1-002-gateway-4.cjs':'r1-002-launcher-4.cjs';
const child=spawn(process.execPath,[path.join(__dirname,target),'--start'],{stdio:'inherit',windowsHide:true});
child.on('error',e=>{console.error(e.message);process.exitCode=1});
child.on('exit',code=>{process.exitCode=code??1});
