// JavaScript Document
document.body.addEventListener('copy',function(e){
	if(window.getSelection().toString() && window.getSelection().toString().length > 30){
		setClipboardText(e);
	}
});
function setClipboardText(event){
	var clipboardData = event.clipboardData || window.clipboardData;
	if(clipboardData){
		event.preventDefault();
		var htmlData = window.getSelection().toString() + '<br>' + '<br>' + '--------------------' + '<br>' + '作者：木辛木杉' + '<br>' + '原文：' + window.location.href + '<br>' + 'MIT License' + '<br>' + 'Copyright (c) 2019-2025 木辛木杉';
		var textData = window.getSelection().toString() + '\n' + '\n' + '--------------------' + '\n' + '作者：木辛木杉' + '\n' + '原文：' + window.location.href + '\n' + 'MIT License'+ '\n' + 'Copyright (c) 2019-2025 木辛木杉';
		clipboardData.setData('text/html', htmlData);
		clipboardData.setData('text/plain',textData);
	}
}
