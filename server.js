// const express = require("express");
// const socketio = require("socket.io");
// const app = express();
// var cors = require("cors");
// app.use(express.static(__dirname + "/public"));
// app.use(cors());
// const PORT = process.env.PORT || 3000;
// const server = app.listen(PORT, () =>
//   console.log(`Server has started on port ${PORT}`)
// );

// const io = socketio(server, {
//     cors: {
//       origin: "*", // Allow all origins
//       methods: ["GET", "POST"]
//     }
//   });
// let sockets = [];
// let searching = [];
// let notAvailable = [];

// io.on("connection", async (socket) => {
//   sockets.push(socket);
//   const allSockets = await io.allSockets();
//   io.emit("numberOfOnline", allSockets.size);

//   socket.on("start", (id) => {
//     sockets = sockets.filter((s) => {
//       if (s.id === id) {
//         searching.push(s);
//         return;
//       } else {
//         return s;
//       }
//     });

//     let i = 0;
//     while (i < searching.length) {
//       const peer = searching[i];
//       if (peer.id !== id) {
//         searching = searching.filter((s) => s.id !== peer.id);
//         searching = searching.filter((s) => s.id !== id);
//         notAvailable.push(socket, peer);

//         const socketRoomToLeave = [...socket.rooms][1];
//         const peerRoomToLeave = [...peer.rooms][1];

//         socket.leave(socketRoomToLeave);
//         peer.leave(peerRoomToLeave);

//         const roomName = `${id}#${peer.id}`;

//         socket.join(roomName);
//         peer.join(roomName);
//         io.of("/")
//           .to(roomName)
//           .emit("chatStart", "You are now chatting with a random stranger");

//         break;
//       }

//       socket.emit("searching", "Searching...");

//       i++;
//     }
//   });

//   socket.on("newMessageToServer", (msg) => {
//     // get room
//     const roomName = [...socket.rooms][1];
//     io.of("/").to(roomName).emit("newMessageToClient", { id: socket.id, msg });
//   });

//   socket.on("typing", (msg) => {
//     const roomName = [...socket.rooms][1];

//     const ids = roomName.split("#");

//     const peerId = ids[0] === socket.id ? ids[1] : ids[0];

//     const peer = notAvailable.find((user) => user.id === peerId);

//     peer.emit("strangerIsTyping", msg);
//   });

//   socket.on("doneTyping", () => {
//     const roomName = [...socket.rooms][1];

//     const ids = roomName.split("#");

//     const peerId = ids[0] === socket.id ? ids[1] : ids[0];

//     const peer = notAvailable.find((user) => user.id === peerId);

//     peer.emit("strangerIsDoneTyping");
//   });

//   socket.on("stop", () => {
//     const roomName = [...socket.rooms][1];

//     const ids = roomName.split("#");

//     const peerId = ids[0] === socket.id ? ids[1] : ids[0];

//     const peer = notAvailable.find((user) => user.id === peerId);

//     peer.leave(roomName);
//     socket.leave(roomName);

//     peer.emit("strangerDisconnected", "Stranger has disconnected");

//     socket.emit("endChat", "You have disconnected");

//     notAvailable = notAvailable.filter((user) => user.id !== socket.id);
//     notAvailable = notAvailable.filter((user) => user.id !== peer.id);

//     sockets.push(socket, peer);
//   });

//   socket.on("disconnecting", async () => {
//     const roomName = [...socket.rooms][1];

//     if (roomName) {
//       io.of("/").to(roomName).emit("goodBye", "Stranger has disconnected");

//       const ids = roomName.split("#");

//       const peerId = ids[0] === socket.id ? ids[1] : ids[0];

//       const peer = notAvailable.find((user) => user.id === peerId);

//       peer.leave(roomName);

//       notAvailable = notAvailable.filter((user) => user.id !== peerId);

//       sockets.push(peer);
//     }

//     sockets = sockets.filter((user) => user.id !== socket.id);
//     searching = searching.filter((user) => user.id !== socket.id);
//     notAvailable = notAvailable.filter((user) => user.id !== socket.id);
//   });

//   socket.on("disconnect", async () => {
//     const allSockets = await io.allSockets();

//     io.emit("numberOfOnline", allSockets.size);
//   });
// });
// load required modules
var http    = require("http");              // http server core module
var express = require("express");           // web framework external module
var sio     = require("socket.io");         // web socket external module
var easyrtc = require("easyrtc");           // EasyRTC external module
var cors = require("cors");

// setup and configure Express http server. Expect a subfolder called "static" to be the web root.
var httpApp = express();
httpApp.use(express.static(__dirname + "/public"));
httpApp.use(express.json());
httpApp.use(cors())

httpApp.get("/", function(req, res) {
    res.sendfile(__dirname + "/index.html");
});

// start Express http server
var port = process.env.PORT || 5000;
var webServer = http.createServer(httpApp).listen(port);

// start Socket.io so it attaches itself to Express server
var io = httpApp.listen(webServer, {"log level":1});

// start EasyRTC server
easyrtc.listen(httpApp, io, {logLevel:"debug", logDateEnable:true});

var userList = {};
var waitingList = {};
var socketCount=0;

io.sockets.on("connection", function(socket) {
  socketCount++;

  socket.on("init_user", function(userData){
    // update the list of users
    userList[socket.id] = {"id": socket.id, "name": userData.name};
    
    // send the connected user list to the new user
    socket.emit("ui_user_set", userList);
    // send the new user to the all other users
    socket.broadcast.emit("ui_user_add", userList[socket.id]);
  });
  
  socket.on("next_user", function() {
    if(waitingList[socket.id]) return;

    if (Object.keys(waitingList).length == 0) {
      waitingList[socket.id] = true;
    } else {
      // pick a partner from the waiting list
      socket.partnerId = Object.keys(waitingList)[0];

      // connect two user with each other
      socket.emit("connect_partner", {'caller':false, 'partnerId': socket.partnerId});
      partnerSocket = io.sockets.socket(socket.partnerId);
      partnerSocket.partnerId = socket.id;
      partnerSocket.emit("connect_partner", {'caller':true, 'partnerId': socket.id});
      
      // delete the partner from the waiting list
      delete waitingList[socket.partnerId];
    }
  });
});

// Since "disconnect" event is consumed by easyRTC,
// socket.on("disconnect",function(){}) will not work
// use easyrtc event listener for disconnect
easyrtc.events.on("disconnect", function(connectionObj, next){
  // call the default disconnect method 
  easyrtc.events.emitDefault("disconnect", connectionObj, next);

  var socket = connectionObj.socket;
  var id = socket.id; 
  // clear the server side variables
  socketCount--;
  delete userList[id];
  delete waitingList[id];
  
  // adjust the client side
  io.sockets.emit("ui_user_remove", id);
  if (socket.partnerId){
    partnerSocket = io.sockets.socket(socket.partnerId);
    partnerSocket.emit("disconnect_partner", socket.id);
    socket.partnerId = null;
  }
});