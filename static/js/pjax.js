$(document).pjax('a[date-pjax]', '#main-content', {
        fragment: '#main-content', timeout: '60000'
        });
$(document).on('ready pjax:end', function(event) {
	var sliderHref = window.location.href;
	$("#slider-link a").each(function(){
		if($(this).attr('href') == sliderHref){
			$(this).css({'opacity':'.7','background-color':'#000','border-radius':'5px','padding':'2px','cursor':'not-allowed','text-decoration':'none'})
		}else{
			$(this).removeAttr("style","")
		}
	})
        hljs.highlightAll();
	hljs.initLineNumbersOnLoad();
        twikoo.init({
                envId: 'https://twikoo.muxmus.com',
                el: '#tcomment',
                lang: 'zh-CN'
                })
        });
hljs.highlightAll();
hljs.initLineNumbersOnLoad()
