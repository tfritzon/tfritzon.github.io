var app = new Vue({
    el: '#app',
    data: {
        message: '',
	smessage: '',
	dmessage: '',
        freq: 670,
        speed: 80,
        farnsworth: 80,
	attack: 0.005,
	release: 0.005,
	c: '',
	morseQueue: [],
	play: true,
	morsetab: morseTable,
	incomingNews: new Map(),
	currId: '',
	currNews: '',
	incNews: [],
	rcvNews: [],
	timer: ''
    },
    filters: {
	uppercase: function(v) {
	    if(!v) return '';
	    return v.toString().toUpperCase();
	}
    },
    created: function() {
	this.audio = new AudioContext();

	this.amp = this.audio.createGain();
	this.amp.gain.value = 0;
	this.amp.connect(this.audio.destination);

	this.osc = this.audio.createOscillator();
	this.osc.frequency.value = this.freq;
	this.osc.start(this.audio.currentTime);
	this.osc.connect(this.amp);

	this.sched = new WebAudioScheduler({ context: this.audio });
	this.sched.start(this.runner);
	this.prog = document.getElementById("prog");

	Vue.use(VueResource);
	Vue.use(JsDiff);

	this.loadNews();
	this.timer = setInterval(this.loadNews, 60000);
    },
    watch: {
	freq: function(f) {
	    this.osc.frequency.value = f;
	},
	speed: function(s) {
	    if(s < this.farnsworth) {
		this.farnsworth = s;
	    }
	},
	farnsworth: function(s) {
	    if(s > this.speed) {
		this.speed = s;
	    }
	},
	message: function(s) {
	    this.message = s.toUpperCase();
	},
	currId: function(id) {
	    console.log(id);
	    this.currNews = this.incomingNews.get(id);
	    this.smessage = this.renderTelegram(this.currNews);
	    console.log(this.incomingNews.get(id));
	}
    },
    computed: {
	dit: function() { return 60.0/(this.speed*10); },
	dah: function() { return 3*this.dit; },
	espace: function() { return this.dit; },
	fdit: function() { return 60.0/(this.farnsworth*10); },
	cspace: function() { return 3*this.fdit; },
	wspace: function () { return 7*this.fdit },
	sending: function() { return (this.c + this.morseQueue.join('')).substr(0,36) },
	progress: function() {
	    if(this.message.length > 0)
		return 1-(this.morseQueue.length/this.message.length);
	    else
		return 0;
	},
	playstate: function() {
	    if(this.play)
		return "PAUSE"
	    else
		return "PLAY"
	},
	smessage: function() {
	}
    },	
    methods: {
	morse: function(e) {
	    if(e.key.length > 1)
		this.morseQueue.push(" ");
	    else
		this.morseQueue.push(e.key.toUpperCase());
	},
	runner: function(e) {
	    var t = e.playbackTime;
	    if ((this.morseQueue.length > 0) && this.play) {
		t2 = Date.now()/1000.0;
		console.log('runner tick, queue=', this.morseQueue);
		this.c = this.morseQueue.shift();
		var m = this.morsetab[this.c];
		if (m) {
		    for (var i = 0; i < m.length; i++) {
			switch(m[i]) {
			case '.':
			    this.amp.gain.setValueAtTime(0, t);
			    this.amp.gain.linearRampToValueAtTime(1, t+this.attack);
			    t += this.dit;
			    this.amp.gain.setValueAtTime(1, t);
			    this.amp.gain.linearRampToValueAtTime(0, t+this.release);
			    t += this.espace-this.release;
			    break;
			case '-':
			    this.amp.gain.setValueAtTime(0, t);
			    this.amp.gain.linearRampToValueAtTime(1, t+this.attack);
			    t += this.dah;
			    this.amp.gain.setValueAtTime(1, t);
			    this.amp.gain.linearRampToValueAtTime(0, t+this.release);
			    t += this.espace;
			    break;
			case '_':
			    t += this.dit*1.5;
			    break;
			case ' ':
			    t += this.wspace-this.espace-this.cspace;
			    break;
			}
		    }
		}
	    } else {
		this.c = '';
	    }
	    t += this.cspace-this.espace-this.release;
	    this.sched.insert(t, this.runner);
	},
	clear: function(e) {
	    this.dmessage = '';
	    this.smessage = '';
	    this.message = "";
	    this.morseQueue = [];
	},
	check: function(e) {
	    diff = JsDiff.diffChars(this.smessage, this.message);
	    console.log(diff);
	    this.dmessage = JsDiff.convertChangesToXML(diff);
	    this.rcvNews = this.rcvNews.concat([this.currNews]);
	},
	start: function(e) {
	    this.message = '';
	    this.dmessage = '';
	    this.send(e);
	},
	loadNews: function() {
	    this.$http.get('https://api.sr.se/api/rss/program/83').then(resp => {
		dom = this.parseXml(resp.body);
		console.log(dom);
		telegrams = this.parseRSS(dom);
		console.log(telegrams);

		this.incNews = telegrams.concat(this.incNews);
		for(t of telegrams) {
		    console.log(t.id);
		    this.incomingNews.set(t.id, t);
		}

		this.rssdom = dom;
	    }, error => {
		console.error(error);
	    });
	},
	send: function(e) {
	    if(this.morseQueue.length <= 0) {
		s = "   " + this.smessage;
		for(i in s) {
		    this.morseQueue.push(s[i]);
		}
	    } else {
		this.play = true;
	    }
	},
	renderTelegram: function(t) {
	    m = 'QTC DE SR SR = ' + t.headline.toUpperCase() + " = " +
		this.stripHTML(t.summary).toUpperCase() + " = +";

	    return m;
	},
	stripHTML: function(s) {
	    div = document.createElement("div");
	    div.innerHTML = s

	    return div.textContent || div.innerText || '';
	},
	playpause: function(e) {
	    this.play = !this.play;
	},
	parseXml: function(xml) {
	    var dom = null;
	    if (window.DOMParser) {
		try { 
		    dom = (new DOMParser()).parseFromString(xml, "text/xml"); 
		} 
		catch (e) { dom = null; }
	    }
	    else if (window.ActiveXObject) {
		try {
		    dom = new ActiveXObject('Microsoft.XMLDOM');
		    dom.async = false;
		    if (!dom.loadXML(xml)) // parse error ..

			window.alert(dom.parseError.reason + dom.parseError.srcText);
		} 
		catch (e) { dom = null; }
	    }
	    else
		alert("cannot parse xml string!");
	    return dom;
	},
	parseRSS: function(rss) {
	    var telegrams = [];

	    rtop = rss.firstElementChild
	    for(var i= 8; i < rtop.childElementCount; i++) {
		elem = rtop.children[i];
		if(elem.childElementCount < 9) {
		    continue;
		}
		console.log(elem);
		id = elem.firstElementChild.textContent;
		hl = elem.children[1].textContent;
		sum = elem.children[2].textContent;
		pub = this.renderPub(elem.children[3].textContent);
		upd = elem.children[4].textContent;
		console.log(elem.children[5]);
		auth = elem.children[5].firstElementChild.textContent;
		ftext = elem.children[8].textContent;

		if(! this.incomingNews.has(id)) {
		    telegram = {"id":id, "headline": hl, "summary": sum,
				"published": pub, "updated": upd,
				"author": auth, "full-text": ftext,
				"rendered": "<i>" + pub + "</i> | <b>" + hl + "</b><br>" +
				this.stripHTML(sum)};

		    telegrams = telegrams.concat([telegram]);
		}
	    }
	    return telegrams;
	},
	renderPub: function(d) {
	    return d.replace('T', ' ').substring(0, d.length-9);
	},
	translate: function(s) {
	    return s.toLocaleUpperCase().replace(/:/g, ' - ').replace(/"/g, '/');
	}
    }
});
