import { EndpointConstants, FileConstants } from "./constants.mjs";
import icons from "./libs/file-icons-js-3.3.0/package/dist/js/file-icons.js"

function genericFsJSONReqConfigGenerator(path) {
    return {
        "method": "POST",
        "headers": new Headers({
            "Content-Type": "application/json",
        }),
        "body": JSON.stringify(
            { "Path": path }
        )
    };
}

export class FileOp {
    static isDirectory(path) {
        return path.endsWith('/'); 
    }
    static getObjName(path) {
        // who needs regex
        return path.split('/').join(' ').trimEnd().split(' ').pop();  
    }
    static removeRoot(path) {
        let segments = path.split("/"); 
        segments.shift(); 
        return segments.join('/');
    }
    static appendRoot(path, rootName = '.') {
        return rootName + (path[0] == '/' ? '' : '/') + path; 
    }

    static async read(path) {
        const relativeToRealRoot = this.appendRoot(this.removeRoot(path));

        const approveRes = await fetch(EndpointConstants.kFileReadApprove, genericFsJSONReqConfigGenerator(relativeToRealRoot));
        if (!approveRes.ok) {
            // it's probably a 400 or 500, so let's just give it to whatever's using read so they can handle it
            return approveRes; 
        }
        const readToken = (await approveRes.json())["readToken"];
        if (!readToken) {
            console.log("well, smth's definely going on here"); 
            return new Response(null, {
                "status": 500
            }); 
        }
        return fetch(new URL(relativeToRealRoot, EndpointConstants.kBinaryRead), {
            "headers": new Headers({
                "x-read-token": readToken,
            }),
        });
    }

    static async dirList(path) {
        let requestConfig = genericFsJSONReqConfigGenerator(path); 

        let results = await fetch(EndpointConstants.kFileDirList, requestConfig)

        const listing = await results.json(); 
        return listing; 
    }

}

export class DirectoryListing {
    static async nestedListing(startPath, recurse = true) {
        let dirListing = await FileOp.dirList(startPath);

        let listing = {};
        listing["_$startPath$_"] = startPath;
        for (let i in dirListing) {
            const fileType = dirListing[i];
            if (fileType == FileConstants.kDirectory) {
                listing[i] = await this.nestedListing(startPath + i + '/');
                continue;
            }
            listing[i] = FileConstants.kFile;
        }
        return listing;
    }; 
    static flattenNestedListing(nested) {
        let listing = [];
        const startPath = nested["_$startPath$_"];
        delete nested["_$startPath$_"];
        for (let name in nested) {
            let item = nested[name];
            if (item === FileConstants.kFile) {
                listing.push(startPath + name);
                continue;
            }
            listing = listing.concat(this.flattenNestedListing(item));
        }
        return listing;
    };
}

export class PreViewIcons {
    static attach(element) {
        document.getElementsByTagName("div")[0].className
    }
}
