

export const FileConstants = class {
    static kRootFilePlaceHolder = "root-file-placeholder"; 
    static kDirectory = "Dir";
    static kFile = "File";   
}

export const EndpointConstants = class {
    static kWWWRoot =  new URL(document.location.origin); //new URL("http://127.0.0.1:8080/"); 
    static kAPI = new URL("/api", this.kWWWRoot);
    static kEndpointsRoot = new URL("/endpoints", this.kWWWRoot); 

    static kBinary = new URL("/endpoints/binary", this.kWWWRoot); 
    static kBinaryWrite = new URL("/endpoints/binary/uploader", this.kWWWRoot); 
    // this's a root read directory, make sure there's a '/' ending the URL 
    static kBinaryRead = new URL("/endpoints/binary/read/", this.kWWWRoot);
    
    static kFileRoot = new URL("/api/fs", this.kWWWRoot);
    static kFileDirList = new URL("/api/fs/dirList", this.kWWWRoot); 
    static kFileReadApprove = new URL("/api/fs/readPreApprove", this.kWWWRoot); 

} 
