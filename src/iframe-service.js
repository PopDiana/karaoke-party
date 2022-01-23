export class IframeService {
  constructor() {
    this.player
  }
  onYouTubePlayerAPIReady(id) {
    this.player = new YT.Player("player", {
      videoId: id,
      autoplay: 1,
      modestbranding: 1
    });
    this.player.addEventListener("onReady", "onYouTubePlayerReady");
    this.player.addEventListener("onStateChange", "onYouTubePlayerStateChange");
  }

  onPlayerReady(event) {
    event.target.playVideo();
  }

  onPlayerStateChange(event) {
    let done = false;
    if (event.data == YT.PlayerState.PLAYING && !done) {
      setTimeout(stopVideo, 6000);
      done = true;
    }
  }
  playVideo() {
    this.player.playVideo();
  }
  stopVideo() {
    this.player.stopVideo();
  }
  pauseVideo() {
    this.player.pauseVideo();
  }
  playNextVideo() {
    this.player.nextVideo();
  }
  playerGetVolume() {
    this.player.getVolume
  }
  playerSetVolume(number) {
    this.player.setVolume(number)
  }

}