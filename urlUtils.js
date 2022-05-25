var parseQueryString = function( queryString ) {
    var params = {}, queries, temp, i, l;
    // Split into key/value pairs
    queries = queryString.split("&");
    // Convert the array of strings into an object
    for ( i = 0, l = queries.length; i < l; i++ ) {
        temp = queries[i].split('=');
        params[temp[0]] = temp[1];
    }
    return params;
};

const urlUtils = {
    getUrlParams : function(href){
        if(!href.match(/:\/\//) || !href.match(/\?/)){
            return {};
        }
        var search = href.split('?')[1];
        if(!search){
            return {};
        }
        // http://stackoverflow.com/questions/8648892/
        return parseQueryString(search);
        // JSON.parse(
        //     '{"' + search.replace(/&/g, '","').replace(/=/g,'":"') + '"}',
        //     function(k, v) { return k === "" ? v : decodeURIComponent(v); });
    },
    getUrlParam: function(href, paramName){
        return this.getUrlParams(href)[paramName];
    },
    addUrlParams : function(newParameters){
        var parameters = this.getUrlParams(location.href);
        for(var nkey in newParameters){
            parameters[nkey] = encodeURIComponent(newParameters[nkey]);
        }
        var newSearch = "";
        for(var okey in parameters){
            newSearch += newSearch ? "&" : "?";
            newSearch += okey  + "=" + parameters[okey];
        }
        var newUrl = location.pathname + newSearch;
        history.pushState(null, null, newUrl);
    }
};

export default urlUtils;
