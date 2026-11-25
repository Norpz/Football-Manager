import WebsocketManager from '../js/util/websocket-manager.js';

let socketManager = new WebsocketManager(onSocketMessage);

const markerElements = [
    document.getElementById('marker0'),
    document.getElementById('marker1'),
    document.getElementById('marker2'),
    document.getElementById('marker3'),
];

const predefinedPlacements = [
    [ [0, 0], [1, 1], [-1, 1] ],        // Placement 1
    [ [0, 0.5], [1, -1], [-1, -0.5] ],  // Placement 2
    [ [0.5, 0], [-0.5, 0.5], [0, -0.5] ], // Placement 3
    [ [1, 0], [-1, 0.5], [0, -1] ],     // Placement 4
];

const boxElement = document.getElementById('box');
const containerElement = document.getElementById('container');
const wrapperElement = document.getElementById('wrapper');
const freeThrowRobotElement = document.getElementById('freethrow-robot');
const videoElement = document.getElementById('court-video');

let activeGameState = null;
let scaleX = 1;
let scaleY = 1;

function onSocketMessage(message) {
    try {
        const info = JSON.parse(message);

        switch (info.event) {
            case 'game_state':
                activeGameState = info.params;

                // For normal rounds, override with random predefined placement
                if (!info.params.freeThrows) {
                    info.params.ballPlacement = getRandomPlacement();
                }

                constrenderState(info.params);
                break;

            case 'game_state_change':
                handleGameStateChange(info.params.type);
                break;
        }
    } catch (error) {
        console.info(error);
    }
}

function handleGameStateChange(type) {
    if (type === 'roundStarted' || type === 'freeThrowAttemptStarted') {
        wrapperElement.classList.remove('active');
    } else if (type === 'roundStopped' || type === 'freeThrowAttemptEnded' || type === 'roundEnded') {
        wrapperElement.classList.add('active');
    }
}

function coordinateMetersToPercent(value, scale) {
    return value / scale * 50 + 50;
}

function constrenderState(state) {
    if (!state) return;

    const { robots, rounds, freeThrows, ballPlacement } = state;

    if (freeThrows) {
        // Free throw logic
        const { baskets, robots, rounds } = freeThrows;
        const lastRound = rounds[rounds.length - 1];
        const roundCount = lastRound?.length || 0;
        const robotIndex = roundCount % 2;
        const robot = robots[robotIndex];
        const basket = baskets[robotIndex];

        const freeThrowBallOffsetFromCenter = 2.25 + 0.05 - 0.16 - 1.3;
        const freeThrowBallX = (basket === 'blue' ? -freeThrowBallOffsetFromCenter : freeThrowBallOffsetFromCenter);
        const freeThrowBallY = 0;

        freeThrowRobotElement.innerText = robot.name;
        freeThrowRobotElement.classList.add('active');

        boxElement.innerHTML = `<div class="dot" style="left: ${coordinateMetersToPercent(freeThrowBallX, 2.25)}%;top: ${coordinateMetersToPercent(freeThrowBallY, 1.5)}%"></div>` +
                               `<div class="robot-position" style="left: ${coordinateMetersToPercent(0, 2.25)}%;top: ${coordinateMetersToPercent(0, 1.5)}%"></div>`;
    } else {
        // Normal rounds
        freeThrowRobotElement.innerText = '';
        freeThrowRobotElement.classList.remove('active');

        const lastRound = rounds[rounds.length - 1];
        const baskets = lastRound?.baskets || [];
        const leftRobot = robots[1 - (baskets.indexOf('blue'))];
        const rightRobot = robots[1 - (baskets.indexOf('magenta'))];

        boxElement.innerHTML = `<div class="left-robot">${leftRobot.name}</div>` +
                               `<div class="right-robot">${rightRobot.name}</div>` +
                               ballPlacement.map(point => `<div class="dot" style="left: ${(point[0]/2.25*50)+50}%;top: ${(-point[1]/1.5*50)+50}%"></div>`).join('');
    }
}

// Utility: pick a random predefined placement
function getRandomPlacement() {
    const index = Math.floor(Math.random() * predefinedPlacements.length);
    return predefinedPlacements[index];
}

// ---------- Matrix / transform utilities (unchanged) ----------
function adj(m) { return [ m[4]*m[8]-m[5]*m[7], m[2]*m[7]-m[1]*m[8], m[1]*m[5]-m[2]*m[4], m[5]*m[6]-m[3]*m[8], m[0]*m[8]-m[2]*m[6], m[2]*m[3]-m[0]*m[5], m[3]*m[7]-m[4]*m[6], m[1]*m[6]-m[0]*m[7], m[0]*m[4]-m[1]*m[3] ]; }
function multmm(a, b) { const c = Array(9); for (let i=0;i<3;i++) for(let j=0;j<3;j++){ let cij=0; for(let k=0;k<3;k++){cij+=a[3*i+k]*b[3*k+j];} c[3*i+j]=cij;} return c;}
function multmv(m, v) { return [ m[0]*v[0]+m[1]*v[1]+m[2]*v[2], m[3]*v[0]+m[4]*v[1]+m[5]*v[2], m[6]*v[0]+m[7]*v[1]+m[8]*v[2] ]; }
function basisToPoints(x1,y1,x2,y2,x3,y3,x4,y4){ const m=[x1,x2,x3,y1,y2,y3,1,1,1]; const v=multmv(adj(m),[x4,y4,1]); return multmm(m,[v[0],0,0,0,v[1],0,0,0,v[2]]);}
function general2DProjection(x1s,y1s,x1d,y1d,x2s,y2s,x2d,y2d,x3s,y3s,x3d,y3d,x4s,y4s,x4d,y4d){ const s=basisToPoints(x1s,y1s,x2s,y2s,x3s,y3s,x4s,y4s); const d=basisToPoints(x1d,y1d,x2d,y2d,x3d,y3d,x4d,y4d); return multmm(d,adj(s)); }
function transform2d(elt,x1,y1,x2,y2,x3,y3,x4,y4){ const w=elt.offsetWidth,h=elt.offsetHeight; let t=general2DProjection(0,0,w,0,0,h,w,h,x1,y1,x2,y2,x3,y3,x4,y4); for(let i=0;i<9;i++) t[i]/=t[8]; t=[t[0],t[3],0,t[6],t[1],t[4],0,t[7],0,0,1,0,t[2],t[5],0,t[8]]; elt.style.transform='matrix3d('+t.join(',')+')';}
function scaleXY(element,sX,sY){element.style.transform=`scaleX(${sX}) scaleY(${sY})`;}

// ---------- Corner handling (unchanged) ----------
let currentDraggedCorner=-1,currentSelectedCorner=-1,corners=[100,100,550,100,100,400,550,400];
try { const savedCorners=JSON.parse(localStorage.getItem('corners-with-camera')); if(Array.isArray(savedCorners)&&savedCorners.length===8) corners=savedCorners; } catch(e){console.error(e);}
function update(){ transform2d(videoElement,...corners); for(let i=0;i<8;i+=2){ const elt=markerElements[i/2]; elt.style.left=(corners[i]-20)+'px'; elt.style.top=(corners[i+1]-20)+'px'; elt.classList.toggle('active',i===currentSelectedCorner); }}
function move(x,y){ corners[currentSelectedCorner]+=x; corners[currentSelectedCorner+1]+=y; update(); }
window.addEventListener('mousedown',e=>{ const x=e.pageX,y=e.pageY; let best=400; currentDraggedCorner=-1; for(let i=0;i<8;i+=2){ const dx=x-corners[i],dy=y-corners[i+1]; if(best>dx*dx+dy*dy){best=dx*dx+dy*dy; currentDraggedCorner=i; currentSelectedCorner=i;} } move(0,0); });
window.addEventListener('mousemove',e=>{ if(currentDraggedCorner>=0) move(e.movementX,e.movementY); });
window.addEventListener('mouseup',()=>{ currentDraggedCorner=-1; localStorage.setItem('corners-with-camera',JSON.stringify(corners)); });
document.addEventListener('keydown',e=>{ if(e.code==='Space'){ e.preventDefault(); wrapperElement.classList.toggle('active'); } else if(e.code.startsWith('Digit')){ const d=parseInt(e.code[5],10); if(d>=1&&d<=4) currentSelectedCorner=(d-1)*2; } else if(e.code.startsWith('Arrow')&&currentSelectedCorner>=0&&currentSelectedCorner<8){ const m=e.ctrlKey?0.1:e.shiftKey?10:1; switch(e.code){ case'ArrowUp': move(0,-m);break; case'ArrowDown': move(0,m);break; case'ArrowLeft': move(-m,0);break; case'ArrowRight': move(m,0);break; }} else{ switch(e.code){ case'KeyX': scaleX=-scaleX; scaleXY(containerElement,scaleX,scaleY); break; case'KeyY': scaleY=-scaleY; scaleXY(containerElement,scaleX,scaleY); break; } } update(); });
document.addEventListener('keyup',()=>{ localStorage.setItem('corners-with-camera',JSON.stringify(corners)); });

// ---------- Camera ----------

const cameraConstraints = { video: {width: {ideal: 1920}, height: {ideal: 1080}}, audio:false };
navigator.mediaDevices.getUserMedia(cameraConstraints)
    .then(stream=>{ videoElement.srcObject=stream; })
    .catch(error=>console.log('Rejected!',error));

// ---------- Camera helper functions (unchanged) ----------
async function getBestCamera(criteriaFunc){ return navigator.mediaDevices.getUserMedia({audio:false,video:true}).then(()=>navigator.mediaDevices.enumerateDevices().then(devices=>{ const sorted=devices.filter(d=>d.kind==='videoinput').toSorted((a,b)=>criteriaFunc(a.getCapabilities(),b.getCapabilities())); return sorted[0]; })); }
function compareResolutions(c1,c2){ return (c1.height.max*c1.width.max)>(c2.height.max*c2.width.max); }

update();
