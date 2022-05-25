export default function makeTimeKeeper(){
    var lastNow, lastRealNow, lastBeatCount, speed, beat, realTimePerBeat,
        tempoTap;
    
    var reset = function(){
        beat = lastRealNow = lastNow = lastBeatCount = tempoTap = 0;
        speed = realTimePerBeat = 1;
    };

    var getTime = function(realNow){
        var interval = realNow - lastRealNow,
            now = lastNow + interval * speed / realTimePerBeat;
        lastRealNow = realNow;
        lastNow = now;
        return now;
    };

    var hasBeatChanged = function(now){
        var beatCount = beat ? Math.floor(now/beat) : 0;
        var hasChanged = beatCount != lastBeatCount;
        lastBeatCount = beatCount;
        return hasChanged;
    };

    var convertToRealTime = function(interval){
        return interval / speed * realTimePerBeat; 
    };

    var convertFromRealTime = function(realTimeInterval){
        return realTimeInterval / convertToRealTime(1); 
    };

     /* return true if we are waiting for another tap */
    var tapTempo = function(now){
        if(tempoTap){
            realTimePerBeat = convertToRealTime(now - tempoTap) / beat ;
            tempoTap = 0;
            return false;
        }else{
            tempoTap = now;
            return true;
        }
    };

    reset();
    return {reset: reset, getTime: getTime, hasBeatChanged: hasBeatChanged,
            tapTempo: tapTempo, convertFromRealTime: convertFromRealTime,
            getBeat: function(){ return beat; },
            setBeat: function(b){ beat = b; },
            getSpeed: function(s) { return speed; },
            setSpeed: function(s) { speed = s; }
           };
};
