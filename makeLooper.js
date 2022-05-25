import makeTimeKeeper from './makeTimeKeeper.js';
import makeLine from './makeLine.js';
import actions from './actions.js';
import io from './io.js';

var makeLooper = function(opts){
    // state is what is going to be exported
    // all the rest is information that can be discarded/recalculated at reload
    var state, currentLine, lineColor, strokeWidth, lifetime, 
        timeKeeper = makeTimeKeeper(), periods, beatListener, 
        graphics, stopped, ps, background, availableWidth, availableHeight,
        toCallInNextFrame = [];
    
    var reset = function(thePeriods, dimension){
        state = {lines: []}, 
        state.width = dimension.width;
        state.height = dimension.height;
        availableWidth = dimension.width;
        availableHeight = dimension.height;
        timeKeeper.reset();
        currentLine = lineColor = strokeWidth = lifetime = null;
        periods = thePeriods || 1;
    };

    var waitForNextFrame = (a) => new Promise(
        resolve => toCallInNextFrame.push(() => {resolve(a);}));
    
    var exportData = function(){
        var data = {
            width: state.width || graphics.canvas.width / ps.view.pixelRatio,
            height: state.height || graphics.canvas.height / ps.view.pixelRatio,
            speed: timeKeeper.getSpeed(),
            lineData: state.lines.map(function(l){
                return l.exportData();})};
        if(background){
            data.backgroundColor = background.fillColor.toCSS();  
        }
        return data;
    };

    var clearState= function(){
        var oldState = state;
        setState({width: availableWidth, height: availableHeight, lines: []});
        oldState.lines.forEach(function(line){ line.clear(); });
        return waitForNextFrame();
    };
    
    var importData = function(data, availableSize){
        clearState();
        state.width = data.width || 1000;
        state.height = data.height || 600;
        scale(availableSize);
        if(data.hasOwnProperty('speed')){
            timeKeeper.setSpeed(data.speed);
        }
        if(!data.hasOwnProperty('backgroundColor')){
            data.backgroundColor = '#ffffff'; // old format
        }
        setBackground(data.backgroundColor);
        data.lineData.forEach(function(dt){
            var line = makeLine(dt.color, dt.strokeWidth, dt.lifetime,
                                now(), dt.beat, dt.multiPeriod, ps);
            line.importData(dt);
            state.lines.push(line);
        });
        return waitForNextFrame();
    };

    var setState = function(newState){
        state = newState;
        scale();
    };
    
    var importDataAction = function(data, availableSize){
        var oldState = state;
        return {do: function(){ return importData(data, availableSize); },
                undo: function(){
                    clearState();
                    setState(oldState);
                }};
    };

    var clearAction = function(){
        var oldState = state;
        return {do: clearState,
                undo: function(){
                    setState(oldState);
                }};
    };

    var addLineAction = function(line){
        return {do:  function(){ state.lines.push(line); },
                undo: function(){ state.lines.pop();
                                  line.clear();}};
    };
    var newLine = function(now, multiPeriod){
        currentLine = makeLine(lineColor,
                               strokeWidth,
                               lifetime,
                               now,
                               timeKeeper.getBeat(),
                               multiPeriod, 
                               ps);
        actions.do(addLineAction(currentLine));
        return currentLine;
    };
    var drawPoint = function(x, y, now){
        currentLine.pushSegment([x,y], now);
    };
    var completeLine = function(now){
        currentLine.completeCreation(now);
        currentLine = null;
    };
    var installListeners = function(){
        var t = new ps.Tool();
        t.minDistance = 3;
        t.onMouseDown = function(e){ 
            newLine(now(), periods); 
            drawPoint(e.point.x,e.point.y, now());
        };
        t.onMouseDrag = function(e){ drawPoint(e.point.x,e.point.y, now()); };
        t.onMouseUp = function(){ completeLine(now()); };
    };
    
    var now = function(){ 
        return timeKeeper.getTime(Date.now()); 
    };


    var determineCanvasDimension = function (canvas, width, height){
        return {width: width || 1000, height: height || 600};
    };
    
    var provideCanvas = function(canvasParent){
        var canvas = canvasParent.firstChild;
        if(!canvas){
            canvas = document.createElement('canvas');
            canvasParent.innerHTML = '';
            canvasParent.appendChild(canvas);
        }
        return canvas;
    };
    
    var calculateDimension = function(dimension){
        var correctDim = {width: dimension.width || 1000,
                          height: dimension.height || 600},
            screenRatio = correctDim.width / correctDim.height;
        if(dimension.ratio){
            if(screenRatio < dimension.ratio){
                correctDim.height = correctDim.width / dimension.ratio;
            }else{
                correctDim.width = correctDim.height * dimension.ratio;
            }
            console.log(dimension.width, dimension.height, correctDim);
        }
        return correctDim;
    };

    var setup = function(config){
        var theBeat = config.beat,
            multiPeriod = config.multiPeriod,
            dimension = calculateDimension(config);
        graphics = config.graphics;
        reset(multiPeriod, dimension);
        timeKeeper.reset();
        timeKeeper.setBeat(theBeat || 2000);
        ps = new graphics.paper.PaperScope();
        ps.setup(graphics.canvas);
        if(!config.readonly){
            installListeners();
        }
        // colored background to make gif exporting work
        setBackground(config.backgroundColor);
        scale(dimension);
        ps.view.draw();
    };
    
    /** Scale the animation to maximum size within available width & height.*/ 
    var scale = function(newAvailableSize){
        if(newAvailableSize){
            var dimension = calculateDimension(newAvailableSize);
            availableWidth = dimension.width;
            availableHeight = dimension.height;
        }
        var widthRatio = state.width / state.height,
            maxW =  availableWidth / availableHeight < widthRatio,
            width = maxW ? availableWidth : Math.floor(availableHeight * widthRatio),
            height = Math.floor(width / widthRatio),
            zoom = width/state.width;
        ps.activate();
        ps.view.zoom = zoom;
        var center = new graphics.paper.Point(
            graphics.canvas.width/2/zoom / ps.view.pixelRatio,
            graphics.canvas.height/2/zoom / ps.view.pixelRatio);
        ps.view.center = center;
        ps.view.viewSize = new graphics.paper.Size(width, height);
        if(background){
            setBackground(background.fillColor);
        }
    };

    var setBackground = function(backgroundColor){
        ps.activate();
        if(backgroundColor){
            var newBackground = new ps.Path.Rectangle(ps.view.bounds);
            newBackground.fillColor = backgroundColor;
            if(background){
                background.replaceWith(newBackground);
            }
            background = newBackground;
        }else{
            if(background){
                background.remove();
                background = null;
            }
        }
    };
    
    var redrawAllLines = function(time){
        // ps.activate();
        state.lines.forEach(function(line){
            line.redraw(time);
        });
        ps.view.draw();
    };

    var start = function(){
        console.log('start');
        ps.activate();
        stopped = false;
        var render = function(){
            var time = timeKeeper.getTime(Date.now());
            redrawAllLines(time);
            if(timeKeeper.hasBeatChanged(time) && beatListener){
                beatListener(time);
            }
            while(toCallInNextFrame.length > 0){
                toCallInNextFrame.pop()();
            }
            if(!stopped){
                requestAnimationFrame(render);
            }
        };
        render();
    };

    var stop = function(){
        
        console.log('stop');
        stopped = true;
    };
    
    var gcd = function(a,b) {
        // http://stackoverflow.com/questions/17445231/js-how-to-find-the-greatest-common-divisor#17445304
        if (a < 0) a = -a;
        if (b < 0) b = -b;
        if (b > a) {var temp = a; a = b; b = temp;}
        while (true) {
            if (b === 0) return a;
            a %= b;
            if (a === 0) return b;
            b %= a;
        }
    };

    var lcm = function(a, b) {
        return (a * b) / gcd(a, b);   
    };

    var makeGifRecorder = function(){
        return io.makeGifRecorder(graphics.canvas);
    };

    var findShortestLoop = function(){
        return state.lines.map(function(line){
            var ignore = line.getMultiPeriod() === 'auto' ;
            return ignore ? 1 : line.calculateDuration();
        }).reduce(lcm);
    };

    var record = function(opts){
        var theProgressCallback = opts.progress,
            duration = opts.duration || Math.min(6000, findShortestLoop()),
            fullSize = opts.fullSize,
            rGraphics = opts.graphics,
            // max 6 seconds
            targetWidth = fullSize ? graphics.canvas.width : 500,
            recWidth = targetWidth / ps.view.pixelRatio,
            recHeight = recWidth / graphics.canvas.width*graphics.canvas.height,
            recordingStart = timeKeeper.getTime(Date.now()),
            //https://en.wikipedia.org/wiki/GIF#Animated_GIF
            // Delay for each frame is specified in hundredths of a second.
            // Choose a number of images that results in an integer sec/100
            // 5, 10, 20, 25 images per second
            imagesPerSecond = 20, 
            realInterval = 1000 / imagesPerSecond,
            interval = timeKeeper.convertFromRealTime(realInterval);
        if(!rGraphics){
            rGraphics = {canvas: document.getElementById('hidden-canvas'),
                        paper: graphics.paper};
        }
        var looperOpts = {graphics: rGraphics,
                          width: recWidth,
                          height: recHeight};
        if(background){
            looperOpts.backgroundColor =  background.fillColor;
        }
        var recLooper = makeLooper(looperOpts),
            gifRecorder = recLooper.makeGifRecorder();
        recLooper.importData(exportData());
        stop();
        for(var time = 0; time < duration ; time += interval){
            recLooper.redrawAllLines(recordingStart + time);
            gifRecorder.recordImage();
        }
        return gifRecorder.makeGif(realInterval,theProgressCallback,fullSize)
            .then(function(gif){
                start();
                return gif;
            });
    };
    
    var makeCircleLineData = function(lineOpts, origin, size, speed){
        var center = {x: origin.x + size.width/2,
                      y: origin.y + size.height/2},
            radius = size.width / 2,
            dist = Math.PI * 2 * radius /2,//* 7 / 8,
            interval = 1000 / 50, // ms
            step = speed * interval,
            lineData = {start: lineOpts.start || 0,
                        last: lineOpts.last || lineOpts.beat ,
                        beat: lineOpts.beat,
                        lifetime: lineOpts.lifetime,
                        color: "#000000",
                        multiPeriod: 1,
                        strokeWidth: lineOpts.strokeWidth};
        speed = speed || 0.05; // pixels/ms
        lineData.times = [];
        lineData.segments = [];
        for(var d = 0; d < dist; d += step ){
            var angle =  d / radius - Math.PI / 2;
            lineData.segments.push([center.x + Math.sin(angle) * radius,
                                    center.y - Math.cos(angle) * radius]); 
            lineData.times.push(d / speed);
        };
        return lineData;
    };

    var makeSinLineData= function(lineOpts, origin, size, speed){
        speed = speed || 0.05; // pixels/ms
        var width = size.width,
            height = size.height ,
            x = origin.x,
            y = origin.y,
            //https://www.intmath.com/applications-integration/11-arc-length-curve.php
            //  \/\/  cos 0 -  4 PI
            dist = 4 * Math.sqrt(Math.pow(height,2) + Math.pow(width/4,2)),
            interval = 1000 / 50, // ms
            step = speed * interval,
            xstep = width / dist * step,
            lineData = {start: lineOpts.start || 0,
                        last: lineOpts.last || lineOpts.beat ,
                        beat: lineOpts.beat,
                        lifetime: lineOpts.lifetime,
                        color: "#000000",
                        multiPeriod: 1,
                        strokeWidth: lineOpts.strokeWidth};
        lineData.times = [];
        lineData.segments = [];
        for(var d = 0 ; d < dist; d += step ){
            var angle =  d / dist * Math.PI * 4;
            lineData.segments.push([
                x + d / dist * width ,
                y + (Math.cos(angle - Math.PI) + 1) / 2 * height / 2]); 
            lineData.times.push(d / speed);
        };
        return lineData;
    };
    
    var makeStraightLineData = function(opts, from, size, speed){
        var distX = size.width,
            distY = size.height,
            dist = Math.sqrt(Math.pow(distX,2) + Math.pow(distY,2)),
            dXRatio = distX / dist,
            dYRatio = distY / dist,
            interval = 1000 / 50, // ms
            step = speed * interval,
            lineData = {start: opts.start || 0,
                    last: opts.last || opts.beat,
                    beat: opts.beat,
                    lifetime: opts.lifetime,
                    color: "#000000",
                    multiPeriod: 1,
                    strokeWidth: opts.strokeWidth};
        speed = speed || 1/40, // pixels/ms,
        lineData.times = [];
        lineData.segments = [];
        for(var d = 0; d < dist; d += step ){
            lineData.segments.push([from.x + d*dXRatio, from.y + d*dYRatio]); 
            lineData.times.push(d / speed);
        };
        return lineData;
    };
    
    var makeTimingDemo = function(canvas, timings, canvasSize){
        var demoSize = {x: canvasSize.width / timings[0].length,
                        y: canvasSize.height / timings.length},
            margin = {x: 50, y: (demoSize.y - 50)/2},
            innerSize ={ width: demoSize.x - margin.x * 2,
                    height: demoSize.y - margin.y * 2},
            data = {width: canvasSize.width ,
                    height: canvasSize.height,
                    backgroundColor: false,
                    lineData: []},
            looper = makeLooper({graphics: {canvas:canvas,
                                            paper: graphics.paper},
                                 backgroundColor: false,
                                 width: data.width, height: data.height});
        timings.forEach(function(row,rowIndex){
            row.forEach(function(timing, colIndex){
                var strokeWidth = 7,
                    xOffset = Math.round(colIndex * demoSize.x) + margin.x ,
                    yOffset = Math.round( rowIndex * demoSize.y ) + margin.y,
                    opts = {beat: timing.beat,
                            lifetime: timing.lifetime,
                            strokeWidth: strokeWidth},
                    speed = 0.05,
                    origin = {x: xOffset, y: yOffset + innerSize.height / 2},
                    ldata = looper.makeStraightLineData(opts,
                                                        {x: origin.x ,
                                                         y: origin.y  },
                                                        {width: innerSize.width,
                                                         height: 0}, 
                                                      speed);
                data.lineData.push(ldata);
            });
        });
        console.log('timings', JSON.stringify(data));
        looper.importData(data);
        looper.start();
        //looper.redrawAllLines(800);
        return looper;
    };
    
    var getLastUpdateTime = function(){
        var length =  state.lines.length ;
        return length ? state.lines[length-1].getLastUpdateTime() : 0;
    };
    
    setup(opts);

    return {
        start: start,
        stop: stop,
        exportData: exportData,
        now: now,
        newLine: newLine,
        drawPoint: drawPoint,
        completeLine: completeLine,
        importData: (d,s) => actions.do(importDataAction(d,s)),
        clear: () => actions.do(clearAction()),
        setLineColor: function(c) { lineColor = c;},
        setStrokeWidth: function(w) { strokeWidth = w;},
        setLifetime: function(l) { lifetime = l;},
        setPeriods: function(p) {
            periods = p;
        },
        scale: scale,
        getTime: timeKeeper.getTime.bind(timeKeeper),
        setSpeed: timeKeeper.setSpeed.bind(timeKeeper),
        setBeat: timeKeeper.setBeat.bind(timeKeeper),
        tapTempo: function(){ return timeKeeper.tapTempo(now()); },
        setBeatListener: function(b){ beatListener = b; },
        redrawAllLines: redrawAllLines,
        makeGifRecorder: makeGifRecorder,
        findShortestLoop: findShortestLoop,
        record: record,
        makeCircleLineData: makeCircleLineData,
        makeSinLineData: makeSinLineData,
        makeStraightLineData: makeStraightLineData,
        makeTimingDemo: makeTimingDemo,
        getLastUpdateTime: getLastUpdateTime,
        waitForNextFrame: waitForNextFrame,
        _ps: ps
    };
};

export default  makeLooper
