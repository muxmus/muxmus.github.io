// JavaScript Document
$("#bg").append("<div id=\"bg1\"></div><div id=\"bg2\"></div><img id=\"bg3\"></img><div id=\"artist\"><img id=\"bf\" class=\"bf\" src=\"https://img.muxmus.com/svg/bf.svg\" alt=\"\" ><img id=\"zt\" class=\"zt\" src=\"https://img.muxmus.com/svg/zt.svg\" alt=\"\" ><img id=\"yc\" class=\"yc\" src=\"https://img.muxmus.com/svg/yc.svg\" alt=\"\" ><img id=\"xs\" class=\"xs\" src=\"https://img.muxmus.com/svg/xs.svg\" alt=\"\" ><a id=\"title\" href=\"\" target=\"_blank\"></a></div><div class=\"left\"><div class=\"left1\"><svg xmlns=\"http://www.w3.org/2000/svg\" version=\"1.1\" viewBox=\"0 0 32 32\"><path d=\"M22 16l-10.105-10.6-1.895 1.987 8.211 8.613-8.211 8.612 1.895 1.988 8.211-8.613z\"></path></svg></div></div><div class=\"right\"><div class=\"right1\"><svg xmlns=\"http://www.w3.org/2000/svg\" version=\"1.1\" viewBox=\"0 0 32 32\"><path d=\"M22 16l-10.105-10.6-1.895 1.987 8.211 8.613-8.211 8.612 1.895 1.988 8.211-8.613z\"></path></svg></div></div>");
var animation = false;
var nextFlag = true;
var autoFlag = true;
var bgI = 0;
var bgCount;
var bgNum;
var time;
var timer;
var pixiv = new Array();
var bgOriginal = new Array();
var thisPixiv;
var nextPixiv;
var zIndex1 = "z-index: -10;";
var zIndex2 = "z-index: -11;";
$.ajax({
	type:"get",
	url: "https://api.muxmus.com/pixiv",
	dataType:"json",
	success:function(jsonData){
		bgCount = jsonData.length - 1;
		for (var i = 0;i <= bgCount;i++){
			pixiv[i] = jsonData[i];
			pixiv[i].url += "@3840w_2160h.webp";
			bgOriginal[i] = i;
		};
		bgOriginal.sort(function(){
			return 0.5 - Math.random();
		});
		thisPixiv = pixiv[bgOriginal[0]];
		nextPixiv = pixiv[bgOriginal[1]];
		animationStart();
	},
});
function animationStart(){
	clearInterval(timer);
	$("#bg1").attr("style","background: url(\"" + thisPixiv.url + "\") center center / cover no-repeat fixed black; opacity: 1;" + zIndex1);
	document.getElementById("title").innerHTML = "id: " + thisPixiv.id + " 画师：" + thisPixiv.artist;
	$("#title").attr("href","https://www.pixiv.net/artworks/" + thisPixiv.id);
	animation = true;
	time = setTimeout("animationEnd()",1500);
};
function animationEnd(){
	animation = false;
	$("#bg1").attr("style","transition: none; opacity: 0;" + zIndex1);
	$("#bg2").attr("style","background: url(\"" + thisPixiv.url + "\") center center / cover no-repeat fixed black;" + zIndex2);
	$("#bg3").attr("src",nextPixiv.url);
	document.getElementById("title").innerHTML = "id: " + thisPixiv.id + " 画师：" + thisPixiv.artist;
	$("#title").attr("href","https://www.pixiv.net/artworks/" + thisPixiv.id);
	if(autoFlag){
		secondClick();
	};
};
function nextSwitch(){
	if(bgI <= bgCount - 2){
		if(animation){
			if(!nextFlag){
				bgI++;
				clearTimeout(time);
				thisPixiv = pixiv[bgOriginal[bgI]];
				nextPixiv = pixiv[bgOriginal[bgI + 1]];
				animationEnd();
			}else{
				clearTimeout(time);
				thisPixiv = pixiv[bgOriginal[bgI]];
				nextPixiv = pixiv[bgOriginal[bgI + 1]];
				animationEnd();
			};
		}else{
			bgI++;
			thisPixiv = pixiv[bgOriginal[bgI]];
			nextPixiv = pixiv[bgOriginal[bgI + 1]];
			animationStart();
		};
	}else if(bgI == bgCount - 1){
		if(animation){
			if(!nextFlag){
				bgI++;
				clearTimeout(time);
				thisPixiv = pixiv[bgOriginal[bgI]];
				nextPixiv = pixiv[bgOriginal[bgI]];
				animationEnd();
			}else{
				clearTimeout(time);
				thisPixiv = pixiv[bgOriginal[bgI]];
				nextPixiv = pixiv[bgOriginal[bgI + 1]];
				animationEnd();
			};
		}else{
			bgI++;
			thisPixiv = pixiv[bgOriginal[bgI]];
			nextPixiv = pixiv[bgOriginal[bgI]];
			animationStart();
		};
	}else{
		if(animation){
			clearTimeout(time);
			thisPixiv = pixiv[bgOriginal[bgI]];
			nextPixiv = pixiv[bgOriginal[bgI]];
			animationEnd();
		}else{
			bgNum = bgOriginal[bgCount];
			bgOriginal.sort(function(){
				return 0.5 - Math.random();
			});
			ifNext();
			bgI = 0;
			thisPixiv = pixiv[bgOriginal[bgI]];
			nextPixiv = pixiv[bgOriginal[bgI + 1]];
			animationStart();
		};
	};
	nextFlag = true;
};
function lastSwitch(){
	if(bgI >= 1){
		if(animation){
			if(nextFlag){
				bgI--;
				clearTimeout(time);
				thisPixiv = pixiv[bgOriginal[bgI]];
				nextPixiv = pixiv[bgOriginal[bgI]];
				animationEnd();
			}else{
				clearTimeout(time);
				thisPixiv = pixiv[bgOriginal[bgI]];
				nextPixiv = pixiv[bgOriginal[bgI]];
				animationEnd();
			};
		}else{
			bgI--;
			thisPixiv = pixiv[bgOriginal[bgI]];
			nextPixiv = pixiv[bgOriginal[bgI]];
			animationStart();
		};
	}else{
		if(animation){
			clearTimeout(time);
			thisPixiv = pixiv[bgOriginal[bgI]];
			nextPixiv = pixiv[bgOriginal[bgI]];
			animationEnd();
		}else{
			bgNum = bgOriginal[bgCount];
			bgOriginal.sort(function(){
				return 0.5 - Math.random();
			});
			ifLast();
			bgI = bgCount;
			thisPixiv = pixiv[bgOriginal[bgI]];
			nextPixiv = pixiv[bgOriginal[bgI]];
			animationStart();
		};
	};
	nextFlag = false;
};
function ifNext(){
	if(bgOriginal[0] == bgNum){
		bgOriginal.sort(function(){
			return 0.5 - Math.random();
		});
		ifNext();
	};
};
function ifLast(){
	if(bgOriginal[bgCount] == bgNum){
		bgOriginal.sort(function(){
			return 0.5 - Math.random();
		});
		ifLast();
	};
};
function secondClick(){
	if(bg3.complete){
		if(autoFlag){
			clearInterval(timer);
			timer = setInterval("nextSwitch()",60000);
		};
	}else{
		bg3.onload = function(){
			if(autoFlag){
				clearInterval(timer);
				timer = setInterval("nextSwitch()",60000);
			};
		};
	};
};
$(function(){
    $("#yc").click(function(){
    	$("#yc").attr("class","xs");
    	$("#xs").attr("class","yc");
    	zIndex1 = "z-index: 115;";
    	zIndex2 = "z-index: 114;";
    	$("#bg1").attr("style",$("#bg1").attr("style") + zIndex1);
    	$("#bg2").attr("style",$("#bg2").attr("style") + zIndex2);
    });
    $("#xs").click(function(){
    	$("#yc").attr("class","yc");
    	$("#xs").attr("class","xs");
    	zIndex1 = "z-index: -10;";
    	zIndex2 = "z-index: -11;";
    	$("#bg1").attr("style",$("#bg1").attr("style") + zIndex1);
    	$("#bg2").attr("style",$("#bg2").attr("style") + zIndex2);
    });
    $(".left").click(function(){
    	lastSwitch();
    });
    $(".right").click(function(){
    	nextSwitch();
    });
	$("#bf").click(function(){
    	 $("#bf").attr("class","zt");
    	 $("#zt").attr("class","bf");
    	 autoFlag = false;
    	 clearInterval(timer);
    });
    $("#zt").click(function(){
    	 $("#bf").attr("class","bf");
    	 $("#zt").attr("class","zt");
    	 autoFlag = true;
    	 secondClick();
    });
});
