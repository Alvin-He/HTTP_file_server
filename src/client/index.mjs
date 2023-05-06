

const APIPATH = new URL("http://127.0.0.1:8080/api")

const templates = {
    "file-obj-js": document.getElementById("template-file-obj-js-clone"),
}

let requestConfig = {
    "method": "POST",
    "headers": new Headers({
        "Content-Type": "application/json",
    }), 
    "body": JSON.stringify({
        "Path": "E:\\Projects\\HTTP_file_server\\src"
    })
}

let results = await fetch(APIPATH + '/fs/dirList',requestConfig)

const fileObjsHolder = document.getElementById("file-objs");

const listing = await results.json()
const objNames = Object.keys(listing);
const objTypes = Object.values(listing);  
for (let i = 0; i < objNames.length; i++) {
    let node = templates["file-obj-js"].cloneNode(true);
    node.id = `file-obj-${i}`
    let slots = node.getElementsByTagName("li");
    slots[0].innerText = objNames[i];
    slots[1].innerText = objTypes[i];
    fileObjsHolder.appendChild(node);
    node.hidden = false; 
}


console.log("index loaded")