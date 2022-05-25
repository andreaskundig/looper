export default function makeLine(color, strokeWidth, lifetime, start, beat, multiPrd,
                        paperScope){
    var data = {start: start,
                last: null,
                beat: beat || 2000,
                lifetime: lifetime || 500,
                color: color || 'black',
                //TODO accept only values 'auto', 'repeat' and falsy
                // currently we have 'auto', 1 and falsy
                multiPeriod: isNaN(multiPrd) ? 'auto' : parseFloat(multiPrd),
                strokeWidth: strokeWidth || 2,
                times: []},
        drawingPaths = [],
        referencePath = new paperScope.Path({visible: false});

    var makePath = function(data){
        return new paperScope.Path({strokeColor: data.color,
                                    strokeWidth: data.strokeWidth,
                                    strokeJoin: 'round',
                                    strokeCap: 'round'});
    };

    var simplifyAndSmooth = function(referencePath){
        var offsets = referencePath.segments.map(function(s){
            return referencePath.getOffsetOf(s.point);
        });
        referencePath.simplify();
        var points = offsets.map(function(o){
            return referencePath.getPointAt(o);
        }).filter(function(p){return p;});
        referencePath.removeSegments();
        referencePath.addSegments(points);
        referencePath.smooth({ type: 'catmull-rom'});
    };

    var setLast = function(dateNow){
        // The end time of the line, after the last point is drawn.
        // This is important when there is no interval duration,
        // as it keeps the line from restarting immediately.
        /* .start    .dateNow
           ----------> last */
        var last = dateNow - data.start;
        /* If we're going back in time, Dates are deaths, not births.
                  .dateNow   .start
                  <----------  (uncorrected last)
         --------->            lifetime  
         <-------------------  last */
        last = last < 0 ? last - data.lifetime : last;
        data.last = last;
    };
   
    var calculateDuration = function(totalElapsedTime){
        if(data.multiPeriod > 0){
            return beat;
        } else if (data.last !== null && data.multiPeriod == 'auto'){
            /* ---------->    last + lifetime
               ......>......> beats
               .............> duration:
                 lowest multiple of beats greater than last 
             */
            var life = Math.abs(data.last) + data.lifetime;
            var intvCount =  Math.ceil(life/beat);
            // var intvCount =  Math.ceil(Math.abs(data.last)/beat);
            return Math.max(1, intvCount) * beat;
        } else if (data.last !== null && data.multiPeriod === 0){
            return Math.abs(data.last) + data.lifetime + 1;
        }else{ 
            // no data.last: the line is being drawn right now
            return totalElapsedTime + 1;
        }
    };

    var calculateTime =  function(dateNow){
        /*
         Calculates the time since the beginning of the current interval.

         .start                          .dateNow
         --------------------------------> totalElapsedTime

         .....>.....>.....>.....>.....> beats (if multiPeriod) 
                                       --> elapsed (since last looper interval)

         ...........>...........> line durations (if not multiPeriod) 
                                 --------> elapsed (since last line interval)

         .dateNow                        .start
         <-------------------------------- totalElapsedTime
      .....>.....>.....>.....>.....>.....> beats (if multiPeriod) 
      ---> elapsed (since last looper interval)
      ...........>...........> line durations 
      --------> elapsed (since last line interval)

         */
        var totalElapsedTime = dateNow - data.start;
        var duration = calculateDuration(totalElapsedTime);
        // Time since the start of last interval.
        var elapsed = totalElapsedTime % duration;
        /* elapsed time can be negative when speed < 0
         .start                      .start + duration
         .-----------------> elapsed = now
         
         .start - duration           .start
                   elapsed <---------. 
         ------------------> now = elapsed + duration
         */
        elapsed = elapsed < 0 ? duration + elapsed : elapsed;
        return {now: elapsed, duration: duration};
    };

    return {
        calculateTime: calculateTime ,
        calculateDuration: calculateDuration,
        getMultiPeriod: function(){ return data.multiPeriod; },
        segmentsToShow:  function(now){
            return referencePath.segments.filter(function(s, i){
                var birth = data.times[i];
                return birth <= now && now < birth + data.lifetime;
            });
        },
        periodSegmentsToShow:  function(dateNow){
            var periodsWithData = 1; 
            var ts = data.times;
            var t  = calculateTime(dateNow);
            var first = ts.length > 0 ? Math.min(ts[ts.length-1], ts[0]) : 0;
            var emptyPeriods = 0;
            if(data.multiPeriod > 0 || data.last !== null){
                // Shift to negative period if line was recorded in reverse.
                emptyPeriods = Math.floor(first / t.duration);
            }
            if(data.multiPeriod > 0 && ts.length > 0 ){
                var last = Math.max(ts[ts.length-1], ts[0]) + data.lifetime;
                var totalPeriods = Math.floor(last / t.duration);
                //var totalPeriods = Math.floor(last / (t.duration+data.lifetime);
                periodsWithData = totalPeriods - emptyPeriods + 1;
            }
            var periodSegments = [];
            for(var i = 0; i < periodsWithData; i++){
                var timeOffset = (emptyPeriods + i) * t.duration || 0;
                var segs = this.segmentsToShow(t.now + timeOffset);
                periodSegments.push(segs); 
            }
            return periodSegments;
        },
        redraw: function(dateNow){
            this.periodSegmentsToShow(dateNow).forEach(function(segs, i){
                if(drawingPaths.length < i + 1){
                    drawingPaths.push(makePath(data));
                    // drawingPaths[drawingPaths.length - 1].blendMode='multiply';
                }
                var path = drawingPaths[i];
                path.removeSegments();
                path.addSegments(segs);
                //path needs two segments to display one point :-P
                if(path.segments.length === 1){path.add(path.segments[0]);}
            });

        },
        pushSegment: function(point, dateNow){
            var birth = dateNow - data.start;
            if(birth < 0){
                /* Going backwards, segments appear at death time.
                .birth      .dateNow
                ------------>  lifetime */
                birth -= lifetime;
            }
            var segment = {point: point};
            data.times.push(birth);
            referencePath.add(segment);
            var previousIndex = referencePath.segments.length - 2;
            referencePath.segments[Math.max(0, previousIndex)].smooth();
        },
        completeCreation: function(absoluteLast){
            setLast(absoluteLast);
            if(referencePath.segments.length>1){
                referencePath.smooth({ type: 'catmull-rom'});
            }
            // unfortunately, this is too expensive. Try a worker?
            //https://developer.mozilla.org/en-US/docs/Web/API/Worker
            //simplifyAndSmooth(referencePath);
        },
        clear: function(){
            drawingPaths.forEach(function(drawingPath){
                drawingPath.removeSegments();
            });
        },
        exportData: function(){
            var exported = new Object(data);
            exported.segments = referencePath.segments.map(function(s){
                return [s.point.x, s.point.y]; 
            });
            return exported;
        },
        importData: function(newdata){
            this.clear();
            referencePath.removeSegments();
            referencePath.addSegments(newdata.segments);
            referencePath.segments.forEach(function(s){ s.smooth(); });
            //don't delete the segments, they might be needed for redo
            // but why was this even deleted in the first place?
            //delete newdata.segments;
            data = newdata;
            data.start = data.start;
        },
        getLastUpdateTime: function(){
            var length =  data.times.length ;
            return  data.start + data.times[length-1] || 0 ;
        }
    };
};
