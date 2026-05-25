// JavaScript Document
var offset = 0.3;
$.ajax({
	type:"get",
	url:"https://api.muxmus.com/music",
	dataType:"json",
	success:function(jsonData){
		for(var i = 0;i <= jsonData.length - 1;i++){
			jsonData[i].url = `https://music.muxmus.com/${jsonData[i].source}/${jsonData[i].id}.${jsonData[i].type}`;
			jsonData[i].cover = `https://music.muxmus.com/${jsonData[i].source}/${jsonData[i].id}.jpg`;
			jsonData[i].lrc = `https://music.muxmus.com/${jsonData[i].source}/${jsonData[i].id}.lrc`;
			delete jsonData[i].type;
			delete jsonData[i].source;
			delete jsonData[i].id;
			delete jsonData[i].coversource;
			delete jsonData[i].coverid;
			delete jsonData[i].sort;
		};
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
				artwork: [{src: currentPlayMeta.cover, size: "350x350", type: "image/jpeg"}]
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