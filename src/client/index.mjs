
const APIPATH = new URL("http://127.0.0.1:8080/api")
const BINARYPATH = new URL("http://127.0.0.1:8080/endpoints/binary")

const templates = {
    "file-obj-js": document.getElementById("template-file-obj-js-clone"),
    "nav-obj-js": document.getElementById("template-nav-obj-js-clone"),
}

function getReqConfig(body) {
    return {
        "method": "POST",
        "headers": new Headers({
            "Content-Type": "application/json",
        }),
        "body": JSON.stringify(body)
    }
}
async function scanDirs(item, uploadDir) {
    //debugger
    if (!item.isDirectory) { 
        item.file((file) => {
            let directory = uploadDir + item.fullPath;
            directory = directory.substring(0, directory.length - file.name.length);
            HandleUploads([file], directory);
        });
        return true; 
    }
    console.log(item.fullPath);
    await MkDir(uploadDir + item.fullPath);
    let directoryReader = item.createReader();
    directoryReader.readEntries((entries) => {
        entries.forEach(async (entry) => {
            scanDirs(entry, uploadDir); 
        });
    });

} 

async function HandleUploads(files, path) {
    // //debugger
    for (let file of files) {
        let filePath = path + '/' + file.name;

        const preApproveConfig = getReqConfig({ "Path": filePath });
        const preApproveRes = await fetch(APIPATH + '/fs/uploadPreApprove', preApproveConfig);
        if (!preApproveRes.ok) {
            console.log(await preApproveRes.text())
            return console.log(`Upload failed for ${file.name}`)
        }
        const json = await preApproveRes.json();
        if (!json["writeToken"]) {
            console.log("bad response ?")
            return console.log(`Network error when uploading ${file.name}`);
        }
        const uploadConfig = {
            "method": "POST",
            "headers": new Headers({
                "Content-Type": "application/octet-stream",
                "x-write-token": json["writeToken"],
            }),
            "body": file
        }
        let res = await fetch(BINARYPATH + '/uploader', uploadConfig);
    }
}

async function MkDir(path) {
    const requestConfig = getReqConfig({
        "Path": path
    }); 
    let res = await fetch(APIPATH + "/fs/mkdir", requestConfig); 
    if (!res.ok) {
        console.log(await res.text())
        return console.log(`Upload failed for Directory ${file.name}`)
    }
    return true; 
}

function findPropagationTarget(node, parentOfTarget) {
    let target = node;
    let previousPropagationTarget = node;

    while (target != parentOfTarget) {
        previousPropagationTarget = target;
        target = target.parentElement;
    }
    return previousPropagationTarget; 
}

const fileObjsHolder = document.getElementById("file-objs");
const fileObjs = fileObjsHolder.children;

let fileObjMapping = {
    "Name": 0, 
    "Type": 1
}

const navbar = document.getElementById("navbar"); 
const navObjsHolder = document.getElementById("nav-objs"); 
const navObjs = navObjsHolder.children; 
function updateAddressBar(newPath) {
    // removing leading and trailing white spaces that split sometimes generates
    let dirNames = newPath.split(/\/+/).join(" ").trim().split(" "); 
    let iMax = navObjs.length > dirNames.length ? navObjs.length : dirNames.length;
    for (let i = 0; i < iMax; i++) {
        let node = navObjs[i]; 
        if (!node) {
            node = templates["nav-obj-js"].cloneNode(true); 
            node.id = `nav-obj-${i}`;
            navObjsHolder.appendChild(node); 
        }
        if (i >= dirNames.length) {
            node.hidden = true; 
            continue;
        }
        let nameNode = node.getElementsByClassName('js-args-name')[0];
        nameNode.innerText = dirNames[i]; 
        node.hidden = false; 
    }

    // update the text bar
    addressBar.value = newPath; 
}

function getSlots(fileObjNode) {
    return fileObjNode.getElementsByTagName("li");
}

async function dirList(path) {
    let requestConfig = getReqConfig({ "Path": path }); 

    let results = await fetch(APIPATH + '/fs/dirList', requestConfig)

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
        let slots = getSlots(node); 
        slots[fileObjMapping["Name"]].innerText = objNames[i];
        slots[fileObjMapping["Type"]].innerText = objTypes[i];

        node.hidden = false;
    }
}


const addressBar = document.getElementById("address-bar");
addressBar.addEventListener(
    "keyup", async (ev) => {
        if (ev.key == "Enter") {
            if (!addressBar.value.endsWith('/')) addressBar.value += '/';
            dirList(addressBar.value);
            updateAddressBar(addressBar.value)
            addressBar.hidden = true;
            navObjsHolder.hidden = false; 
        }
    }
); 
function getCurrentBrowsingPath() { 
    return addressBar.value.split(/\/+/).join(" ").trim().split(" ").join("/");
}
function getCurrentBrowsingDirectory() {
    let dirs = addressBar.value.split(/\/+/).join(" ").trim().split(" "); 
    return dirs[dirs.length - 1];
}

fileObjsHolder.addEventListener("click", async (ev) => {
    let target = findPropagationTarget(ev.target, fileObjsHolder); 

    let slots = getSlots(target); 
    if (slots[fileObjMapping["Type"]].innerText == "Dir") {
        const targetPath = addressBar.value + slots[fileObjMapping["Name"]].innerText + '/' 
        dirList(targetPath); 
        updateAddressBar(targetPath); 
    }

});

navObjsHolder.addEventListener("click", async (ev) => {
    let target = findPropagationTarget(ev.target, navObjsHolder); 

    let iTarget = Number(target.id.split("nav-obj-")[1]);

    let targetPathString = ''; 
    for (let i = 0; i <= iTarget; i++) {
        let node = navObjs[i];
        targetPathString += node.getElementsByClassName('js-args-name')[0].innerText + '/';
    }

    dirList(targetPathString);
    updateAddressBar(targetPathString);
});

navbar.addEventListener("click", async (ev) => {
    if (ev.target == navbar) {
        navObjsHolder.hidden = true; 
        addressBar.hidden = false; 
        addressBar.focus(); 
        addressBar.select();
    }
    console.log(ev.target);
});

addressBar.addEventListener("focusout", async (ev) => {
    addressBar.hidden = true; 
    navObjsHolder.hidden = false; 
}) 

const rightClickMenu = document.getElementById("right-click-menu");
const rightClickMenuOptions = {
    "Download": document.getElementById("right-click-download"),
    "Upload": document.getElementById("right-click-upload"), 
    "Delete": document.getElementById("right-click-delete"),
}

// async (ev) => {...} return string
const rightClickMenuVariableGetters = {
    'currentDir': async (ev) => { return getCurrentBrowsingDirectory(); },
    'fileObjName': async (ev) => { return getSlots(ev.currentlySelected)[fileObjMapping["Name"]].innerText; },
    'fileObjType': async (ev) => { return getSlots(ev.currentlySelected)[fileObjMapping["Type"]].innerText; },

}

const rightClickWindowShow = {
    "Upload": ['Upload To ', rightClickMenuVariableGetters['currentDir']],
    "Download": ['Download ', rightClickMenuVariableGetters['currentDir']],
    "Delete": ['Delete ', rightClickMenuVariableGetters['currentDir']],
}
const rightClickFileObjDirShow = {
    "Upload": ['Upload To ', rightClickMenuVariableGetters['fileObjName']],
    "Download": ['Download ', rightClickMenuVariableGetters['fileObjName']],
    "Delete": ['Delete ', rightClickMenuVariableGetters['fileObjName']]
}
const rightClickFileObjFileShow = {
    "Download": ['Download ', rightClickMenuVariableGetters['fileObjName']],
    "Delete": ['Delete ', rightClickMenuVariableGetters['fileObjName']]
}
async function rightClickComputeOptions(config, ev) {
    const configKeys = Object.keys(config);
    const optionsKeys = Object.keys(rightClickMenuOptions);
    const iMax = configKeys.length > optionsKeys.length ? configKeys.length : optionsKeys.length; 
    for (let i = 0; i < iMax; i++ ) {
        const action = optionsKeys[i];
        let optionHolder = rightClickMenuOptions[action];
        let actionConfig = config[action]
        if (!actionConfig) {
            optionHolder.hidden = true; 
            continue; 
        }
        let finalPrompt = ''
        for (let i of actionConfig) {
            if (i instanceof Function) finalPrompt += await i(ev);
            else finalPrompt += i; 
        }
        optionHolder.innerText = finalPrompt; 
        optionHolder.hidden = false;
    }
}

document.addEventListener('contextmenu', async (ev) => {
    ev.preventDefault();
    rightClickMenu.style.left = ev.clientX + 'px';
    rightClickMenu.style.top = ev.clientY + 'px';

    const target = ev.target
    if (fileObjsHolder.contains(target)) {
        ev.currentlySelected = findPropagationTarget(target, fileObjsHolder);; 
        const fileType = await rightClickMenuVariableGetters["fileObjType"](ev); 
        if (fileType == "Dir") await rightClickComputeOptions(rightClickFileObjDirShow, ev);
        else if (fileType == "File") await rightClickComputeOptions(rightClickFileObjFileShow, ev);
    } else { 
        await rightClickComputeOptions(rightClickWindowShow);
    } 

    rightClickMenu.hidden = false;

    return false; 
});
window.addEventListener("click", async (ev) => {
    rightClickMenu.hidden = true;
});

const uploadHandler = document.getElementById("file-uploader"); 
const navUploadButton = document.getElementById("nav-upload-button");
navUploadButton.addEventListener('click', (ev) => {
    uploadHandler.click();
})
uploadHandler.addEventListener('change', async (ev) => {
    let files = ev.target.files; 
    await HandleUploads(files, getCurrentBrowsingPath()); 
    dirList(getCurrentBrowsingPath()); 
}, false)
window.addEventListener("dragenter", (ev) => {
    ev.stopPropagation();
    ev.preventDefault();
}, false);
window.addEventListener("dragover", (ev) => {
    ev.stopPropagation();
    ev.preventDefault();
}, false);
window.addEventListener("drop", (ev) => {
    ev.stopPropagation();
    ev.preventDefault();

    let data = ev.dataTransfer;
    let fsEntry = data.items[0].webkitGetAsEntry();
    scanDirs(fsEntry, getCurrentBrowsingPath());

    // HandleUploads(data.files, getCurrentBrowsingPath());
}, false);

//////////
// main //
//////////

//default path
dirList("./")
addressBar.value = "."
updateAddressBar("./")
//debugger
console.log("index loaded")