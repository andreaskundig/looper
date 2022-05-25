const ajax = {
    HTTPrequest : function(url, verb, headers, content){
        return new Promise(function(resolve, reject) {
            var req = new XMLHttpRequest();
            req.open(verb, url);
            if (headers){
                for(var key in headers){
                    req.setRequestHeader(key, headers[key]);
                }
            }
            req.onload = function() {
                resolve(req.response);
            };
            req.onerror = function(e) {
                reject(Error("Network Error "+e));
            };
            if(content){
                req.send(content);
            }else{
                req.send();
            }
        });
    }
};
export default ajax;
