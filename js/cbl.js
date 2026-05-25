// JavaScript Document
$("#container-right").append('<div id="sidebar"><div class="scrolling-area"><div class="js"><img class="tx" src="https://img.muxmus.com/icon/bk_8.png" alt="" /><p class="small">社交媒体 / Social Media</p><a href="https://qm.qq.com/cgi-bin/qm/qr?k=rAN0D35rucs2u-MGcaKEHeWCG9tpTPaE" target="_blank"><img class="bq" src="https://img.muxmus.com/badge/木辛木杉-B73636?style=flat-square&logo=qq&logoColor=fff" alt="QQ" /></a><a href="https://steamcommunity.com/id/muxmus/" target="_blank"><img class="bq" src="https://img.muxmus.com/badge/muxmus-103b6b?style=flat-square&logo=steam&logoColor=fff" alt="Steam" /></a><br><a href="https://space.bilibili.com/397649728/" target="_blank"><img class="bq" src="https://img.muxmus.com/badge/木辛木杉-00a1d6?style=flat-square&logo=bilibili&logoColor=fff" alt="bilibili" /></a><a href="https://github.com/muxmus" target="_blank"><img class="bq" src="https://img.muxmus.com/badge/muxmus-181717?style=flat-square&logo=github&logoColor=fff" alt="Github" /></a><p class="small">电子邮箱 / E-mail</p><a href="mailto:muxmus@qq.com"><img class="bq" src="https://img.muxmus.com/badge/muxmus-@qq.com-4169e1?style=flat-square" alt="QQmail" /></a><a href="mailto:dzb1211@gmail.com"><img class="bq" src="https://img.muxmus.com/badge/dzb1211-@gmail.com-C95543?style=flat-square" alt="Gmail" /></a><br><a href="mailto:muxmus@outlook.com"><img class="bq" src="https://img.muxmus.com/badge/muxmus-@outlook.com-fabd03?style=flat-square" alt="Outlook" /></a><a href="mailto:i@muxmus.com"><img class="bq" src="https://img.muxmus.com/badge/i-@muxmus.com-228b22?style=flat-square" alt="Domain" /></a><p class="small">Game uid（点击复制）</p><img id="textYs" class="bq" src="https://img.muxmus.com/badge/原神-116704962-555555?labelColor=EBD0B5&style=flat-square" alt="116704962" title="点击复制" /><br><img id="textZzz" class="bq" src="https://img.muxmus.com/badge/绝区零-10012374-555555?labelColor=000000&style=flat-square" alt="10012374" title="点击复制" /><br><img id="textKlbq" class="bq" src="https://img.muxmus.com/badge/卡拉彼丘-4719613-555555?labelColor=DEDEDE&style=flat-square" alt="4719613" title="点击复制" /><br><img id="textZmd" class="bq" src="https://img.muxmus.com/badge/终末地-1403429893-555555?labelColor=FFFA00&style=flat-square" alt="1403429893" title="点击复制" /><textarea id="input" readonly></textarea><br><br><div id="sidebar-link"><p><a date-pjax id="index" href="https://muxmus.com/">返回首页</a></p><br><p><a date-pjax href="https://muxmus.com/blog/20260509/">由claude完成的音乐半自动更新系统</a></p><p><a date-pjax href="https://muxmus.com/blog/20250607/">【家宽系列第一篇】公网IPv6与防火墙</a></p><p><a date-pjax href="https://muxmus.com/blog/20230802/">低仿pixiv自动轮播背景</a></p><p><a date-pjax href="https://muxmus.com/blog/20220912/">中秋节拍月亮，结果还拍到了木星</a></p><p><a date-pjax href="https://muxmus.com/blog/20220731-2/">一个浏览器主页</a></p><p><a date-pjax href="https://muxmus.com/blog/20220731/">js音乐播放器</a></p><p><a date-pjax href="https://muxmus.com/blog/20220727-2/">天台山</a></p><p><a date-pjax href="https://muxmus.com/blog/20220727/">中华大扁锹饲养日志</a></p></div></div></div></div>');
$("#cbl").append('<div id="topbar"><div id="guide"><a date-pjax href="https://muxmus.com/">博客</a>&nbsp;|&nbsp;<a date-pjax href="https://muxmus.com/project/">项目</a>&nbsp;|&nbsp;<a date-pjax href="https://muxmus.com/update/">更新日志</a>&nbsp;|&nbsp;<a date-pjax href="https://muxmus.com/about/" target="_blank">关于</a></div></div><div class="dk" id="bbb"><img class="cd" alt="" src="https://img.muxmus.com/svg/cd.svg" /></div><div class="gb" id="ccc"><img class="cd" alt="" src="https://img.muxmus.com/svg/gb.svg" /></div>');
$(document).ready(function(){
	var bbb = $("#bbb");
	var ccc = $("#ccc");
	var sidebar = $("#sidebar");
	bbb.click(function(){
		sidebar.css({'transform':'translateX(0)','opacity':'1'});
		bbb.attr("class","gb");
		ccc.attr("class","dk")
	});
	ccc.click(function(){
		sidebar.css({'transform':'translateX(100%)','opacity':'0'});
		ccc.attr("class","gb");
		bbb.attr("class","dk")
	});
	var sidebarHref = window.location.href;
	$("#sidebar-link a").each(function(){
		if($(this).attr('href') == sidebarHref){
			$(this).css({'opacity':'.7','background-color':'#000','border-radius':'5px','padding':'2px','cursor':'not-allowed','text-decoration':'none'})
		}else{
			$(this).removeAttr("style","")
		}
	})
});
$(function(){
	$("#textYs").click(function(){
		var text = $("#textYs").attr("alt");
		var input = document.getElementById("input");
		input.value = text;
		input.select();
		document.execCommand("copy");
		alert("复制成功 原神 " + text)
	});
	$("#textZzz").click(function(){
		var text = $("#textZzz").attr("alt");
		var input = document.getElementById("input");
		input.value = text;
		input.select();
		document.execCommand("copy");
		alert("复制成功 绝区零 " + text)
	});
	$("#textKlbq").click(function(){
		var text = $("#textKlbq").attr("alt");
		var input = document.getElementById("input");
		input.value = text;
		input.select();
		document.execCommand("copy");
		alert("复制成功 卡拉彼丘 " + text)
	});
	$("#textZmd").click(function(){
		var text = $("#textZmd").attr("alt");
		var input = document.getElementById("input");
		input.value = text;
		input.select();
		document.execCommand("copy");
		alert("复制成功 终末地 " + text)
	})
})
