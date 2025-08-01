// JavaScript Document
var offset = 0.3;
$.ajax({
	type:"get",
	url:"https://api.muxmus.com/music",
	dataType:"json",
	success:function(jsonData){
		const ap = new APlayer({
			container: document.getElementById("aplayer"),
			fixed: true,
			theme: "#8E8CD8",
			order: "random",
			volume: 0.3,
			lrcType: 3,
			audio: jsonData
		});
		ap.on("loadstart", () => {
			const currentPlayMeta = ap.list.audios[ap.list.index];
			navigator.mediaSession.metadata = new MediaMetadata({
				title: currentPlayMeta.name,
				artist: currentPlayMeta.artist,
				artwork: [{src: currentPlayMeta.cover, size: "350x350", type: "image/webp"}]
			});
			navigator.mediaSession.setActionHandler("previoustrack",function(){
				ap.skipBack();
				ap.play();
			});
			navigator.mediaSession.setActionHandler("nexttrack",function(){
				ap.skipForward();
				ap.play();
			});
		});
		ap.on('timeupdate', () => {
			ap.lrc.update(ap.audio.currentTime + offset);
		});
	}
});
