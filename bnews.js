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
	morsetab: morseTable
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
	},
	start: function(e) {
	    this.dmessage = '';
	    this.$http.get('https://api.sr.se/api/rss/program/83').then(resp => {
		dom = this.parseXml(resp.body);
		console.log(dom);
		m = 'QTC DE SR SR = ' +
		    dom.firstElementChild.children[8].children[1].textContent +
		    " = " + dom.firstElementChild.children[8].children[2].textContent + ' = +'
		div = document.createElement("div");
		div.innerHTML = m
		m = div.textContent || div.innerText || '';
		this.smessage = this.translate(m);
	    }, error => {
		console.error(error);
	    }).then(x => { this.send(e) });
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
	playpause: function(e) {
	    this.play = !this.play;
	},
	load: function(e) {
	    this.message += this.sektion.text;
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
	translate: function(s) {
	    return s.toLocaleUpperCase().replace(/:/g, ' - ').replace(/"/g, '/');
	}
    }
});
