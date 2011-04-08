

Event.observe(window,'load',function(){
	
	$$('.post-body a').each(function(link){

		if(!link.readAttribute('href').match(/comopolo/i)){
			link.writeAttribute('target','_blank')
		}
	})
	
})
