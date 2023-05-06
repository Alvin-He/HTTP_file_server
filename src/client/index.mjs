

const APIPATH = new URL("http://127.0.0.1:8080/api")

const templates = {
    "file-obj-js": document.getElementById("template-file-obj-js-clone"),
}

function getReqConfig(body) {
    return {
        "method": "POST",
        "headers": new Headers({
            "Content-Type": "application/json",
        }),
        "body": body
    }
}

async function dirList(path) {
    let requestConfig = getReqConfig(JSON.stringify({
        "Path": path
    })); 

    let results = await fetch(APIPATH + '/fs/dirList', requestConfig)

    const fileObjsHolder = document.getElementById("file-objs");
    const fileObjs = fileObjsHolder.children

    const listing = await results.json()
    const objNames = Object.keys(listing);
    const objTypes = Object.values(listing);

    const iMax = fileObjs.length > objNames.length ? fileObjs.length : objNames.length;  
    for (let i = 0; i < iMax; i++) {
        let node = fileObjs[i]
        if (!node) {
            node = templates["file-obj-js"].cloneNode(true);
            node.id = `file-obj-${i}`
            fileObjsHolder.appendChild(node);
        }
        if (i >= objNames.length) {
            node.hidden = true;
            continue
        } 
        let slots = node.getElementsByTagName("li");
        slots[0].innerText = objNames[i];
        slots[1].innerText = objTypes[i];

        node.hidden = false;
    }
}


const addressBar = document.getElementById("address-bar");
addressBar.addEventListener(
    "keyup", async (ev) => {
        if (ev.key == "Enter") {
            dirList(addressBar.value) 
        }
    }
)
console.log("index loaded")