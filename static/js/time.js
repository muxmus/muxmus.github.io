// JavaScript Document
document.write("<div id=\"divt\"></div>");
$(function(){
	startTime();
});
function startTime(){
	var today = new Date();
	var year = today.getFullYear();
	var month = today.getMonth() + 1;
	var day = today.getDate();
	var hh = today.getHours();
	var mm = today.getMinutes();
	var ss = today.getSeconds();
	month = checkTime(month);
	day = checkTime(day);
	hh = checkTime(hh);
	mm = checkTime(mm);
	ss = checkTime(ss);
	document.getElementById('divt').innerHTML = year + "." + month + "." + day + " " + hh + ":" + mm + ":" + ss;
	setTimeout('startTime()',100);
}
function checkTime(i){
	if(i<10){
		i = "0" + i;
	}
	return i;
}
