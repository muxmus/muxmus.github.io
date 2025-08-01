// JavaScript Document
document.write("<div class=\"divm\">");
document.write("	<input type=\"text\" value=\"\" id=\"search\" />");
document.write("	<div class=\"divin\">");
document.write("		<img onClick=\"getinput()\" alt=\"搜索\" id=\"ss\" src=\"https://muxmus.com/img/search.svg\" />");
document.write("	</div>");
document.write("</div>");
function getinput(){
	var con = document.getElementById('search').value;
	window.location.href=("https://cn.bing.com/search?q=" + con);
}
$("#search").bind("keydown",function(e){
	let theEvent = e || window.event;
	let keyCode = theEvent.keyCode || theEvent.which || theEvent.charCode;
	if (keyCode == 13){
		getinput();
	}
});
