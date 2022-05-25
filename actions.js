const actions = (function(){
    var history = {done:[], undone:[]},
	memory = 50;
    
    var undo = function(){
        if(history.done.length > 0){
            var action = history.done.pop();
            action.undo();
            history.undone.unshift(action);
        }
    };

    var redo = function(){
        if(history.undone.length > 0){
            var action = history.undone.shift();
            action.do();
            history.done.push(action);
        }
    };

    var doit = function(action){
        var promise = action.do();
        history.done.push(action);
        history.undone.length = 0;
	if(history.done.length > memory){
	    history.done.shift();
	}
        return promise;
    };

    var installUnRedo = function(undoLinkId, redoLinkId){
        var undoLink = document.getElementById(undoLinkId);
        undoLink.addEventListener("click", undo, false);
        var redoLink = document.getElementById(redoLinkId);
        redoLink.addEventListener("click", redo, false);
    };

    return {installUnRedo: installUnRedo,
            undo: undo,
            redo: redo,
            do: doit};
})();

export default actions;
