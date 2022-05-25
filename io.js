import ajax from './ajax.js';
import urlUtils from './urlUtils.js';
import gifshot from 'gifshot';

const io = {
    convertToJsonp: function(data){
        return "load(" + JSON.stringify(data) + ");"; 
    }};
io.files = {
    installUploader: function(uploadLink, load){
        var loader = document.createElement('input');
        loader.type = 'file';
        loader.style.display= 'none';
        var handleJson = function(uploadEvent){
            var reader = new FileReader();
            reader.onload = function(readerEvent){
                var b64content = readerEvent.target.result;
                var b64 = "base64,";
                var b64index = b64content.indexOf(b64) + b64.length;
                b64content.substr(b64index);
                var content = atob(b64content.substr(b64index));
                eval(content);
            };
            reader.readAsDataURL(uploadEvent.target.files[0]);     
        };
        loader.addEventListener('change', handleJson, false);
        uploadLink.addEventListener("click", loader.click.bind(loader), false);
    },
    dataAsUri: function(data){
        var jsonpData = io.convertToJsonp(data);
        var dataUriPrefix = 'data:application/javascript;base64,';
        return dataUriPrefix  + btoa(jsonpData);
    },
    installDownloader: function(downloadLink, getData){
        downloadLink.setAttribute('download', 'bouboucle.jsonp');
        var download = function(){
            downloadLink.href = this.dataAsUri(getData());
        }.bind(this);
        downloadLink.addEventListener('click', download, false);
    }
};
io.server = {
    save: function(getData, name){
        var fileContent = io.convertToJsonp(getData()),
	    fileName = name || Date.now() + '.js',
            path = "/animations/" + fileName,
            content = encodeURIComponent(fileContent); 
            return ajax.HTTPrequest(path, 'POST',
                                    {"Content-Type": "application/javascript"},
                                    content);
    },
    loadDirAsJson: function(dirName){
        return ajax.HTTPrequest('/animations/'+dirName, 'GET')
	    .catch(console.error.bind(console));
    },
    loadDirAnimationList: function(dirName, fileName){
        fileName = fileName || dirName;
        return ajax.HTTPrequest('/animations/'+dirName+'/'+fileName+'.json',
                                'GET')
            .then(JSON.parse)
	    .catch(console.error.bind(console));
    },
    load: function(src, load){
        return new Promise(function(resolve, reject){
            var old = document.getElementById('the-animation');
            if(old){
                old.parentNode.removeChild(old);
            }
            // GLOBAL
            window.load = async function(){
                await load.apply(this, arguments);
                resolve(0);
            };
            var s = document.createElement( 'script' );
            s.setAttribute('src', src);
            s.setAttribute('id', 'the-animation');
            // s.addEventListener('load', function(){resolve(0);});
            s.addEventListener('error', function(){
                reject('Error loading script.');
            });
            s.addEventListener('abort', function(){
                reject('Script loading aborted.');
            });
            document.head.appendChild(s);
        });
    }
};
io.gists = {
    save: function(getData){
        var data = getData();
        if(data.lineData.length == 0){
            return Promise.resolve(0);
        }
        var fileContent = io.convertToJsonp(getData());
        var content = 
                {description: "stroke looper animation",
                 public: true,
                 files: {"looper.jsonp": {content: fileContent}}};
        var boum = "MVUyWW1KalpqQnpOMkkyWXlRVE4zQVRPNEVETTNjVFlraFRZaUZ6TmlabVpoVldaMFF6TXpvelpwUm1iMXQyY2hWbWNrNVdZIGNpc2FC";
        var headers =  {"Content-Type": "application/json"};
        headers[atob("bm9pdGF6aXJvaHR1QQ==").split('').reverse().join('')] = atob(boum).split('').reverse().join('');
        return ajax.HTTPrequest('https://api.github.com/gists',
                                'POST',
                                headers,
                                JSON.stringify(content))
            .then(JSON.parse)
            .then(function(data){
                var id = data.id;
                // if(data.files['looper.jsonp']){
                //     var raw = data.files['looper.jsonp'].raw_url;
                //     id = raw.match(/[^/]+\/raw\/[^/]+/)[0];
                // }
                var description = 'http://bouboucle.com?gist=' + id;
                content.files['description.md'] = { content: description};
                ajax.HTTPrequest('https://api.github.com/gists/'+data.id,
                                'PATCH',
                                headers,
                                JSON.stringify(content));
                console.log(data);
                urlUtils.addUrlParams({gist: id});
                return id;
            });
    },

    installSaver: function(saveGistLink, getData){
        var saver = function(){
            this.save(getData);
        }.bind(this);
        saveGistLink.addEventListener("click", saver, false);
    },

    makeGistUrl: function(id){
        return 'https://api.github.com/gists/'+id;
    },

    makeRawGistUrl: function(rawId){
        var urlStart = 'https://gist.githubusercontent.com/andreaskundig/';
        // var urlStart = 'https://rawgit.com/andreaskundig/';
        // rawId = rawId.replace(/%2F/g,'/').replace(/\/.*/, '');
        return urlStart+rawId+'/looper.jsonp';
    },
    loadContent: function(id){
        if(false && id.includes('raw')){
            var rawGistUrl = this.makeRawGistUrl(id);
            console.log(rawGistUrl);
            return ajax.HTTPrequest(rawGistUrl, 'GET');
        }else{
            console.log(id);
            id = id.replace(/%2F/g,'/').replace(/\/.*/, '');
            console.log(id);
            var gistUrl = this.makeGistUrl(id);
            return ajax.HTTPrequest(gistUrl, 'GET')
                .then(JSON.parse)
                .then(function(data){
                    if(!data.files || !('looper.jsonp' in data.files)){
                        throw 'no files found';
                    }
                    console.log("load gist " + data.html_url);
                    return data.files['looper.jsonp'].content;
                });
        }
    },
    
    load: function(id, loadFunction){
        const load = loadFunction;
        return this.loadContent(id).then(function(content){
            console.log(content);
            eval(content);
            urlUtils.addUrlParams({gist: id});
        }).catch(console.error.bind(console));
    },

    installLoader: function(loadGistLink, load){
        var promptGist = function(){
            var id = prompt("gist to load").trim();
            if(id){
                id = urlUtils.getUrlParam(id, 'gist') || id;
                console.log('got param gist ', id);
                this.load(id, load);
            }
        }.bind(this);
        loadGistLink.addEventListener("click", promptGist, false);
    }
};
io.makeGifRecorder = function(canvas){
    var totalBlobSize = 0, imgs = [], 
        createImgFromBlob = function(blob){
            //TODO does not work in chrome
            //maybe find a way to check when it's done?
            var newImg = document.createElement("img"),
                url = URL.createObjectURL(blob);
            newImg.onload = function() {
                // no longer need to read the blob so it's revoked
                URL.revokeObjectURL(url);
            };
            newImg.src = url;
            totalBlobSize += blob.size;
            imgs.push(newImg);
        },
        recordImage = function(){
                    //we would need gcd to respect looping
            imgs.push(canvas.toDataURL("image/png"));
            totalBlobSize += imgs[imgs.length-1].length;
            // does not work in chrome...
            // canvas.toBlob(function(blob) {
            //     createImgFromBlob(blob);
            // });
        },
        makeGif = function(interval, progressCallback, fullSize){
            var imgsShallowCopy = imgs.slice(),
                width = canvas.width,
                //shitty heuristics
                estimatedMb = canvas.width/200/15*totalBlobSize/5000000,
                targetMb = 1,
                neededReduction = Math.max(1, estimatedMb/targetMb),
                shrinkFactor = Math.min(1, 1 / Math.sqrt(neededReduction));
            shrinkFactor = fullSize ?  1 : shrinkFactor;
            imgs.length = 0;
            // console.log(imgsShallowCopy.length, 'imgs, interval', interval,
            //             'estimated size', estimatedMb);
            // console.log(shrinkFactor, estimatedMb, neededReduction);
            width = Math.floor(width * shrinkFactor);
            var height = Math.floor(width * canvas.height / canvas.width);
            // console.log(width);
            imgs.length = 0;
            totalBlobSize = 0;
            return new Promise(function(resolve, reject){
                gifshot.createGIF(
                    {interval: interval / 1000,
                     images: imgsShallowCopy,
                     gifWidth: width, 
                     gifHeight: height,
                     // TODO find out how to deal with transparency
                     // transparent: 0,
                     // disposal:0,
                     progressCallback: progressCallback},
                    function(obj) {
                        if(obj.error) {
                            reject(obj);
                            console.log('gifshot error:', obj);
                        }else{
                            resolve(obj.image);
                        }
                    });
            });
        };
    return {recordImage: recordImage, makeGif: makeGif};
};
export default io;
