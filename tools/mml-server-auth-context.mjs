/**
 * Bounded compatibility adaptation for MIT @mml-io 0.28.0 server packages.
 * Upstream: https://github.com/mml-io/3d-web-experience
 * Forward the actual server-side connection socket through the existing auth
 * callbacks and allow a server-selected session key for duplicate detection.
 * Consumers without a session key keep upstream behavior. The replicated user
 * ID stays canonical across devices and the key stays on the server.
 *
 * Whole-file pins intentionally refuse an unknown dependency composition.
 */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,lstatSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const projectRoot=resolve(fileURLToPath(new URL('..',import.meta.url)));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const FILES=[
  {
    "package": "@mml-io/3d-web-user-networking",
    "file": "build/index.js",
    "original": "10686fcb9ec029c83409c73f141e189c96aaa79d1f2715d4b60a08a622adf8b6",
    "adapted": "9dcf6da57f2b576b8f56ed50848ea98a6de361ef66ff538d29647a9ac78045f0",
    "replacements": [
      [
        "await this.options.onClientConnect(connectionId, sessionToken, userIdentity);",
        "await this.options.onClientConnect(connectionId, sessionToken, userIdentity, webSocket);"
      ],
      [
        "this.connectionIdByUserId.delete(client.authenticatedUser.userId);",
        "this.connectionIdByUserId.delete(client.authenticatedUser.connectionKey ?? client.authenticatedUser.userId);"
      ],
      [
        "this.connectionIdByUserId.has(onClientConnectReturn.userId)",
        "this.connectionIdByUserId.has(onClientConnectReturn.connectionKey ?? onClientConnectReturn.userId)"
      ],
      [
        "this.connectionIdByUserId.set(authenticatedUser.userId, connectionId);",
        "this.connectionIdByUserId.set(authenticatedUser.connectionKey ?? authenticatedUser.userId, connectionId);"
      ]
    ],
    "previous": "b51ab0e07778e94023963491e3ba0873e063fdb481aea40c28f64f47ccb6353e"
  },
  {
    "package": "@mml-io/3d-web-experience-server",
    "file": "build/index.js",
    "original": "0bca4cd3d388422f28c80aa084ca98078697bced112e02b41d8a33df3ca308fe",
    "adapted": "a51ffb1a875c06f4fa63b6e5bbb92e66909535b045a1a7831bdb3ca2ef4a1b68",
    "replacements": [
      [
        "onClientConnect: (connectionId, sessionToken, userIdentityPresentedOnConnection) => {",
        "onClientConnect: (connectionId, sessionToken, userIdentityPresentedOnConnection, connectionSocket) => {"
      ],
      [
        "          userIdentityPresentedOnConnection\n        );",
        "          userIdentityPresentedOnConnection,\n          connectionSocket\n        );"
      ]
    ]
  },
  {
    "package": "@mml-io/3d-web-user-networking",
    "file": "build/UserNetworkingServer.d.ts",
    "original": "89094b78fa48e43702902d2a05f0c6c8bf85d86cc58c8c11572f50d4b7a15f00",
    "adapted": "1649b2c76f4f30d875e2163170fa95c7d5a0fa1a7e1928df13bc0b06a27e3f4b",
    "replacements": [
      [
        "onClientConnect: (connectionId: number, sessionToken: string, userIdentity?: UserData) =>",
        "onClientConnect: (connectionId: number, sessionToken: string, userIdentity?: UserData, connectionSocket?: WebSocket) =>"
      ]
    ]
  },
  {
    "package": "@mml-io/3d-web-experience-server",
    "file": "build/Networked3dWebExperienceServer.d.ts",
    "original": "9b86cfb57dc2c12ea4c45ed4cbbf0010ecad001899aa02f2920579468aabc890",
    "adapted": "0df6991c720f0682f32a36531142a480cae50a380611712ae2306cb3f1b43cee",
    "replacements": [
      [
        "onClientConnect(connectionId: number, sessionToken: string, userIdentityPresentedOnConnection?: UserData):",
        "onClientConnect(connectionId: number, sessionToken: string, userIdentityPresentedOnConnection?: UserData, connectionSocket?: WebSocket):"
      ]
    ]
  }
];

export function ensureMmlServerAuthContext({root=projectRoot,check=false}={}){
  const prepared=[];
  // Qualify the entire two-package delta before modifying any installed file.
  for(const item of FILES){
    const directory=join(root,'node_modules',item.package);
    const metadata=JSON.parse(readFileSync(join(directory,'package.json'),'utf8'));
    if(metadata.name!==item.package||metadata.version!=='0.28.0')
      throw Error('MML socket-auth adaptation requires the pinned '+item.package+'@0.28.0');
    const path=join(directory,item.file),info=lstatSync(path);
    if(!info.isFile()||info.size>262144)throw Error('Unexpected MML adaptation input: '+item.package+'/'+item.file);
    const bytes=readFileSync(path),actual=digest(bytes);
    if(actual===item.adapted){prepared.push({item,path,bytes,changed:false});continue;}
    if(actual!==item.original&&actual!==item.previous)throw Error('Unknown MML bytes; refusing auth adaptation: '+item.package+'/'+item.file);
    if(check)throw Error('MML connection auth context is not installed: '+item.package+'/'+item.file);
    let source=bytes.toString('utf8');
    const replacements=actual===item.previous?item.replacements.slice(1):item.replacements;
    for(const [before,after]of replacements){
      if(source.split(before).length!==2)throw Error('Pinned MML auth callsite no longer matches');
      source=source.replace(before,after);
    }
    const adapted=Buffer.from(source);
    if(digest(adapted)!==item.adapted)throw Error('Adapted MML bytes do not match their pin');
    prepared.push({item,path,bytes:adapted,changed:true});
  }
  for(const selected of prepared){
    if(selected.changed)writeFileSync(selected.path,selected.bytes);
    if(digest(readFileSync(selected.path))!==selected.item.adapted)
      throw Error('Installed MML socket-auth adaptation readback failed');
  }
  return {schema:'holodeck.mml-auth-context/v1',version:'0.28.0',files:prepared.map(({item,changed})=>
    ({path:item.package+'/'+item.file,sha256:item.adapted,state:changed?'adapted':'verified'}))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const args=process.argv.slice(2);
  if(args.length>1||args.length===1&&args[0]!=='--check')throw Error('Use no argument to apply, or --check to verify');
  console.log(JSON.stringify(ensureMmlServerAuthContext({check:args[0]==='--check'})));
}
