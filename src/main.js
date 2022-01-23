import * as firebase from "firebase/app";
import "firebase/auth";
import "firebase/firestore";
import * as firebaseui from "firebaseui";

import "./scss/main.scss";
import $ from "jquery";
import { YtSearch } from "./youtube-search-service";
import { Render } from "./render";
import YouTubePlayer from "youtube-player";
import microphoneImage from "./imges/mic.svg";
import warning from "./imges/alert.svg";
import toastr from "toastr";

const firebaseConfig = {
  apiKey: "*****",
  authDomain: "*****",
  databaseURL: "*****",
  projectId: "karaoke-party-application",
  storageBucket: "*****",
  messagingSenderId: "*****",
  appId: "*****",
  measurementId: "*****"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const dbRooms = db.collection("rooms");
const appData = db.collection("appData");
const dbUsers = db.collection("users");
const render = new Render();

let loginUI = new firebaseui.auth.AuthUI(firebase.auth());
let ytSearch = new YtSearch();

let currentRoom = window.location.search.substring(2);
let thisView = window.location.search.substring(1).charAt(0);

function getView() {
  let view = window.location.search.substring(1).charAt(0);
  let roomId = window.location.search.substring(2);
  if (view === "0" || !view) {
    $(".show-screen").hide();
    $(".playlist").hide();
    $(".login").hide();
    $(".app-chatbox").hide();
  } else if (view === "1") {
    $(".show-screen").hide();
    $(".room-view").hide();
    $(".playlist").fadeIn();   
    $(".app-chatbox").fadeIn();
    $(".login").hide();
    loadChatbox();
  } else if (view === "2") {
    const yt = new YT(); 
    $(".room-view").hide();
    $(".playlist").hide();
    $(".show-screen").fadeIn();
    $(".app-chatbox").hide();
    $(".login").hide();
  } else {
    console.error("No view provided", view);
  }

  return roomId;
}

$(document).ready(function() {
  let searchObj = {};

  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      let userID = firebase.auth().currentUser.uid;
      $(".site").show();
      getView();
      showRooms(userID);
      addNewUser();
    } else {
      let link = "";
      if (thisView === 1) {
        link = `?${thisView}${currentRoom}`;
      }
      $(".login").show();

      loginUI.start("#firebaseui-auth-container", {
        signInSuccessUrl: link,
        signInOptions: [
          firebase.auth.GoogleAuthProvider.PROVIDER_ID,
        ],
        tosUrl: "#",
        privacyPolicyUrl: "#"
      });
    }
    if (!$(".firebaseui-card-content li").length) {
      $(".loading-image").show();
      $("#firebaseui-auth-container").hide();
    }
  });

  
  $("#firebaseui-auth-container").on("click", function() {
    $(".loading-image").show();
  });

  $(".rooms").on("click", "#room-name-btn", function(event) {
    event.preventDefault();
    let roomNameInput = $("input#room-name");
    if (roomNameInput.val() && roomNameInput.val().length <= 15) {
      let roomObj = {
        userId: firebase.auth().currentUser.uid,
        userName: firebase.auth().currentUser.displayName,
        userPhoto: firebase.auth().currentUser.photoURL,
        roomName: roomNameInput.val(),
        playing: false,
        order: 1,
        currentSong: 0,
        timeCreated: new Date().getTime(),
        users: [firebase.auth().currentUser.uid],
        subscribed: [firebase.auth().currentUser.uid]
      };
      dbRooms.add(roomObj);
    }
  });

  $(".search-form").submit((event) => {
    event.preventDefault();
    let render = new Render();
    let ytSearchInput = $("#ytSearchInput").val();
    $(".search-results").slideDown("slow");

    async function ytSearchNow() {
      await appData.doc("keys").get().then((docs) => {
        ytSearch.keys = docs.data().apiKeys;
      });
      let response = await ytSearch.getSongByTitle(ytSearchInput);
      searchObj = response;
      if (!response) {
        if (ytSearch.currentKey < ytSearch.keys.length) {
          ytSearch.currentKey += 1;
          response = await ytSearch.getSongByTitle(ytSearchInput);
          searchObj = response;
          ytSearchNow();
        } else {
          $(".search-results").html(
            `<p class="text-center">Your search returned an error status of ${ytSearch.errorMessage}</p>`
          );
        }
      } else if (response.items.length > 0) {
        render.ytSearch(searchObj); 
      } else {
        $(".search-results").html(`<div class="warn" >
        <img class='logo' src="${warning}" alt="alert">
        <p>No Results</p>
        </div>`);
      }
    }
    ytSearchNow();
    $("#ytSearchInput").val("");
  }); 

  $(".logout").click(() => {
    firebase.auth().signOut();
    window.location.href = `../`;
  });

  $(".rooms").on("click", ".show-delete", function() {
    dbRooms.doc(this.value).delete();
  });
 
  $(".rooms").on("click", ".show-playlist", function() {
    window.location.href = `../?1${this.value}`;
  });

  $(".rooms").on("click", ".show-main-show", function() {
    window.location.href = `../?2${this.value}`;
  });

  $(".rooms").on("click", ".show-invite", function() {
    let valueOfButton = this.value;
    $(`#share-link-${valueOfButton}`).slideToggle();
  });

  $(".rooms").on("click", ".copy-to-clipboard", function() {
    let nameValue = this.name;
    let copyInput = document.getElementById(`${nameValue}-input`);
    copyInput.select();
    copyInput.setSelectionRange(0, 99999);
    document.execCommand("copy");
  });

  $(".search-results").on("click", "button", function() {
    let that = this;
    async function pushSong() {
      let dataObj = searchObj.items[that.id];
      let currentOrderNum = "testroom";

      await dbRooms.doc(currentRoom).get().then(function(doc) {
        if (doc.exists) {
          currentOrderNum = doc.data().order;
        } else {
          console.error("No such document!");
        }
      });

      let tempObj = {
        user: firebase.auth().currentUser.displayName,
        order: currentOrderNum,
        videoLink: dataObj.id.videoId,
        videoName: dataObj.snippet.title,
        createdAt: new Date().getTime(),
        img: dataObj.snippet.thumbnails.default.url
      };

      dbRooms
        .doc(currentRoom)
        .collection("playlist")
        .add(tempObj)
        .then(function() {
          sendNotification();
        })
        .catch(function(error) {
          console.error("Error updating document: ", error);
        });

      $(".search-results").slideUp(1000);

      dbRooms.doc(currentRoom).update({ order: (currentOrderNum += 1) });
      dbRooms.doc(currentRoom).get().then(function(doc) { 
        var usersList = doc.data().users;
        if (usersList.indexOf(firebase.auth().currentUser.uid) == -1)
          usersList.push(firebase.auth().currentUser.uid);
        dbRooms.doc(currentRoom).update({ users: usersList});
      });
          
    }

    pushSong();
  });

  $(".rooms").on("click", ".subscribe", function() {
    let room = this.value;
    dbRooms.doc(room).get().then(function(doc) { 
      var subscribedList = doc.data().subscribed;
      if (subscribedList.indexOf(firebase.auth().currentUser.uid) == -1)
      subscribedList.push(firebase.auth().currentUser.uid);
      dbRooms.doc(room).update({ subscribed: subscribedList});
      toastr.info('Subscribed to room notifications');   
    });
  });
  
  $(".rooms").on("click", ".unsubscribe", function() {
    let room = this.value;
    dbRooms.doc(room).get().then(function(doc) { 
      var subscribedList = doc.data().subscribed;
      subscribedList = subscribedList.filter( u => u != firebase.auth().currentUser.uid);
      dbRooms.doc(room).update({ subscribed: subscribedList});
      toastr.info('Unsubscribed from room notifications');
    });
  });

  $(".playlist-render").on("click", ".delete", function() {
    dbRooms.doc(currentRoom).collection("playlist").doc(this.name).delete();
  });

  $(".playlist-render").on("click", ".moveUp", function() {
    let that = this;
    if (parseInt(this.value) > 1) {
      (async () => {
        await dbRooms
          .doc(currentRoom)
          .collection("playlist")
          .where("order", "<", parseInt(this.value))
          .orderBy("order", "desc")
          .limit(1)
          .get()
          .then(function(docs) {
            docs.forEach(function(doc) {
              dbRooms.doc(currentRoom).collection("playlist").doc(doc.id).update({ order: parseInt(that.value) });
            });
          });

        dbRooms.doc(currentRoom).collection("playlist").doc(this.name).update({ order: parseInt(this.value) - 1 });
      })();
    }
  });

  $(".playlist-render").on("click", ".moveDown", function() {
    let that = this;
    (async () => {
      await dbRooms
        .doc(currentRoom)
        .collection("playlist")
        .where("order", ">", parseInt(this.value))
        .orderBy("order", "asc")
        .limit(1)
        .get()
        .then(function(docs) {
          docs.forEach(function(doc) {
            dbRooms.doc(currentRoom).collection("playlist").doc(doc.id).update({ order: parseInt(that.value) });
          });
        });

      dbRooms.doc(currentRoom).collection("playlist").doc(this.name).update({ order: parseInt(this.value) + 1 });
    })();
  });

  dbRooms.doc(currentRoom).collection("playlist").orderBy("order").onSnapshot((querySnapshot) => {
    render.playlist(querySnapshot);
    if (render.listObj.length == 0) {
      $(".playlist-render").append(`
      <div class="no-song">
      <p> Add songs to your playlist to keep singing</p>
      <img class='logo' src="${microphoneImage}" alt="microphone">
      </div>
      `);
    }
    dbRooms.doc(currentRoom).get().then((docs) => {
      $(".room-name").html(docs.data().roomName);
    });
    let tempMessage = {
      userName: "Karaoke Party",
      userId: "welcome-karaoke",
      text: "Welcome to the chat!",
      timeCreated: new Date().getTime()
    };
    dbRooms.doc(currentRoom)
      .collection("messages")
      .limit(1)
      .get()
      .then(sub => {
        if (sub.docs.length == 0) {
          dbRooms
            .doc(currentRoom)
            .collection("messages")
            .add(tempMessage)
            .then(function () {
            })
            .catch(function (error) {
              console.error("Error updating document: ", error);
            });
        }
      });

    dbRooms.doc(currentRoom)
      .collection("messages").orderBy("timeCreated", "asc").onSnapshot((querySnapshot) => {
        var userId = firebase.auth().currentUser.uid;
        render.messages(querySnapshot, userId);
      });
  });

  function showRooms(uid) {
    dbRooms.where("users", "array-contains", uid).orderBy("timeCreated", "desc").onSnapshot(function (querySnapshot) {
      render.roomList(querySnapshot, uid);
    });

  }
});

function addNewUser() {
  var uid = firebase.auth().currentUser.uid;
  dbUsers.where("userId", "==", uid).onSnapshot(function (querySnapshot) {   
    if(querySnapshot.empty) {
      let newUser = {
        userId: firebase.auth().currentUser.uid,
        email: firebase.auth().currentUser.email,
      };
      dbUsers.add(newUser);
    }
  });
}

function onlyUnique(value, index, self) {
  return self.indexOf(value) === index;
}

function sendNotification() {
  dbRooms.doc(currentRoom).get().then((room) => {
    var roomName = room.data().roomName;
    var userName = firebase.auth().currentUser.displayName;
    var uid = firebase.auth().currentUser.uid;
    var users = room.data().subscribed;
    users = users.filter(onlyUnique);
    users = users.filter((user) => user != uid);

    dbUsers.where("userId", "in", users).onSnapshot(function (querySnapshot) {  
      var userEmails = [];
      querySnapshot.forEach(element => {
        userEmails.push(element.data().email)
      });
      var settings = {
        "url": "https://localhost:44309/mail/send/" + userName + '/' + roomName + '/' + currentRoom,
        "method": "POST",
        "headers": {
          "Content-Type": "application/json"
        },
        "data": JSON.stringify(userEmails),
      };
      
      $.ajax(settings).done(function () {});
    });
  });
}

function loadChatbox() {
  var minimchat = document.getElementById("minim-chat");
  minimchat.style.display = "block";
  var maxichat = document.getElementById("maxi-chat");
  maxichat.style.display = "none";
  var e = document.getElementById("chatbox");
  e.style.margin = "0";
}

function minimChatbox() {
  var minimchat = document.getElementById("minim-chat");
  minimchat.style.display = "none";
  var maxichat = document.getElementById("maxi-chat");
  maxichat.style.display = "block";
  var e = document.getElementById("chatbox");
  e.style.margin = "0 0 -300px 0";
}

$("#minim-chat").click(() => {
  minimChatbox();
});

$("#maxi-chat").click(() => {
  loadChatbox();
});

$(".message-form").submit((event) => {
  event.preventDefault(); 
  let messageText = $("#enter-message").val();
  $("#enter-message").val('');
  let tempMessage = {
    userName: firebase.auth().currentUser.displayName,
    userId: firebase.auth().currentUser.uid,
    text: messageText,
    timeCreated: new Date().getTime()
  };
  dbRooms
    .doc(currentRoom)
    .collection("messages")
    .add(tempMessage)
    .then(function () {s
      var msgContainer = document.getElementById("messages-container");
      $("#messages-container").animate({
         scrollTop: msgContainer.scrollHeight - msgContainer.clientHeight
      }, 500);
    })
    .catch(function (error) {
      console.error("Error updating document: ", error);
    });
   
});

function YT() {
  this.isPlaying = false;
  let player = YouTubePlayer("player", {
    controls: 0,
    modestbranding: 1
  });
  player.loadVideoById("ijoFTR2q5Dw");

  $("#start").click(() => {
    advanceSong();
    $("#start").addClass("hidden");
    $(".shuttle-button").removeClass("hidden");
    player.playVideo();
  });

  $("#play").click(() => {
    player.playVideo();
  });

  $("#pause").click(() => {
    player.pauseVideo();
  });

  $("#next").click(() => {
    advanceSong();
  });

  player.on("stateChange", (event) => {
    if (event.data === 0) {
      advanceSong();
    }
  });

  function advanceSong() {
    let playlist = render.listObj;
    if (playlist.length == 0) {
      player.loadVideoById("ijoFTR2q5Dw");
      $(".current-song").html(`<p class="end-playlist">Play list has ended</p>`);
    } else {
      render.updateCurrentSong();
      dbRooms.doc(currentRoom).collection("playlist").doc(render.listObj[0].docId).delete().then(() => {
        player.loadVideoById(render.currentSong.videoLink);
      });
    }
  }
}


