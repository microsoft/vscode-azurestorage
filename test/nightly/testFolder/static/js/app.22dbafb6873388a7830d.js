webpackJsonp([13],{0:function(t,n,e){e("j1ja"),t.exports=e("NHnr")},"5MmI":function(t,n,e){"use strict";n.a={getToken:function(){return window.localStorage.getItem("id_token")},saveToken:function(t){window.localStorage.setItem("id_token",t)},destroyToken:function(){window.localStorage.removeItem("id_token")}}},"9J7/":function(t,n,e){"use strict";var r=e("NYxO"),i=Object.assign||function(t){for(var n=1;n<arguments.length;n++){var e=arguments[n];for(var r in e)Object.prototype.hasOwnProperty.call(e,r)&&(t[r]=e[r])}return t};n.a={name:"RwvHeader",computed:i({},e.i(r.a)(["currentUser","isAuthenticated"]))}},AezD:function(t,n,e){"use strict";e.d(n,"l",function(){return r}),e.d(n,"k",function(){return i}),e.d(n,"j",function(){return a}),e.d(n,"b",function(){return o}),e.d(n,"h",function(){return u}),e.d(n,"c",function(){return c}),e.d(n,"i",function(){return s}),e.d(n,"a",function(){return l}),e.d(n,"m",function(){return f}),e.d(n,"e",function(){return m}),e.d(n,"f",function(){return d}),e.d(n,"d",function(){return v}),e.d(n,"g",function(){return p});var r="setArticles",i="setLoading",a="logOut",o="setArticle",u="setUser",c="setComments",s="setError",l="setProfile",f="setTags",m="addTag",d="removeTag",v="updateAricleInList",p="resetModuleState"},BVEk:function(t,n,e){"use strict";var r=e("9J7/"),i=e("iNIO"),a=e("XyMi"),o=e.i(a.a)(r.a,i.a,i.b,!1,null,null,null);n.a=o.exports},D39R:function(t,n,e){"use strict";function r(t,n,e){return n in t?Object.defineProperty(t,n,{value:e,enumerable:!0,configurable:!0,writable:!0}):t[n]=e,t}var i,a,o=e("7+uW"),u=e("LguZ"),c=e("lHQJ"),s=e("AezD"),l={article:{author:{},title:"",description:"",body:"",tagList:[]},comments:[]},f=Object.assign({},l),m=(i={},r(i,c.e,function(t,n,e){return void 0!==e?t.commit(s.b,e):u.b.get(n).then(function(n){var e=n.data;return t.commit(s.b,e.article),e})}),r(i,c.f,function(t,n){return u.c.get(n).then(function(n){var e=n.data;t.commit(s.c,e.comments)})}),r(i,c.g,function(t,n){return u.c.post(n.slug,n.comment).then(function(){t.dispatch(c.f,n.slug)})}),r(i,c.h,function(t,n){return u.c.destroy(n.slug,n.commentId).then(function(){t.dispatch(c.f,n.slug)})}),r(i,c.i,function(t,n){return u.d.add(n).then(function(n){var e=n.data;t.commit(s.d,e.article,{root:!0}),t.commit(s.b,e.article)})}),r(i,c.j,function(t,n){return u.d.remove(n).then(function(n){var e=n.data;t.commit(s.d,e.article,{root:!0}),t.commit(s.b,e.article)})}),r(i,c.k,function(t){var n=t.state;return u.b.create(n.article)}),r(i,c.l,function(t,n){return u.b.destroy(n)}),r(i,c.m,function(t){var n=t.state;return u.b.update(n.article.slug,n.article)}),r(i,c.n,function(t,n){t.commit(s.e,n)}),r(i,c.o,function(t,n){t.commit(s.f,n)}),r(i,c.p,function(t){(0,t.commit)(s.g)}),i),d=(a={},r(a,s.b,function(t,n){t.article=n}),r(a,s.c,function(t,n){t.comments=n}),r(a,s.e,function(t,n){t.article.tagList=t.article.tagList.concat([n])}),r(a,s.f,function(t,n){t.article.tagList=t.article.tagList.filter(function(t){return t!==n})}),r(a,s.g,function(){for(var t in f)o.a.set(f,t,l[t])}),a),v={article:function(t){return t.article},comments:function(t){return t.comments}};n.a={state:f,actions:m,mutations:d,getters:v}},GTdA:function(t,n,e){"use strict";var r=e("Eoz/"),i=e.n(r);n.a=function(t){return i()(new Date(t),"MMMM D, YYYY")}},GyQG:function(t,n,e){"use strict";var r=e("UVMV"),i=e("I2OV"),a=e("XyMi"),o=e.i(a.a)(r.a,i.a,i.b,!1,null,null,null);n.a=o.exports},I2OV:function(t,n,e){"use strict";e.d(n,"a",function(){return r}),e.d(n,"b",function(){return i});var r=function(){var t=this,n=t.$createElement,e=t._self._c||n;return e("footer",[e("div",{staticClass:"container"},[e("router-link",{staticClass:"logo-font",attrs:{to:{name:"home",params:{}}}},[t._v("\n      conduit\n    ")]),t._v(" "),t._m(0)],1)])},i=[function(){var t=this,n=t.$createElement,e=t._self._c||n;return e("span",{staticClass:"attribution"},[t._v("\n      An interactive learning project from\n      "),e("a",{attrs:{target:"blank",href:"https://thinkster.io"}},[t._v("Thinkster")]),t._v(". Code & design licensed under MIT.\n    ")])}]},IMtK:function(t,n,e){"use strict";e.d(n,"a",function(){return r}),e.d(n,"b",function(){return i});var r=function(){var t=this,n=t.$createElement,e=t._self._c||n;return e("div",{attrs:{id:"app"}},[e("rwv-header"),t._v(" "),e("router-view"),t._v(" "),e("rwv-footer")],1)},i=[]},IcnI:function(t,n,e){"use strict";var r=e("7+uW"),i=e("NYxO"),a=e("Kits"),o=e("itPX"),u=e("D39R"),c=e("IyCy");r.a.use(i.b),n.a=new i.b.Store({modules:{home:a.a,auth:o.a,article:u.a,profile:c.a}})},IyCy:function(t,n,e){"use strict";function r(t,n,e){return n in t?Object.defineProperty(t,n,{value:e,enumerable:!0,configurable:!0,writable:!0}):t[n]=e,t}var i,a=e("LguZ"),o=e("lHQJ"),u=e("AezD"),c={errors:{},profile:{}},s={profile:function(t){return t.profile}},l=(i={},r(i,o.b,function(t,n){var e=n.username;return a.a.get("profiles",e).then(function(n){var e=n.data;return t.commit(u.a,e.profile),e}).catch(function(t){t.response})}),r(i,o.c,function(t,n){var e=n.username;return a.a.post("profiles/"+e+"/follow").then(function(n){var e=n.data;return t.commit(u.a,e.profile),e}).catch(function(t){t.response})}),r(i,o.d,function(t,n){var e=n.username;return a.a.delete("profiles/"+e+"/follow").then(function(n){var e=n.data;return t.commit(u.a,e.profile),e}).catch(function(t){t.response})}),i),f=r({},u.a,function(t,n){t.profile=n,t.errors={}});n.a={state:c,actions:l,mutations:f,getters:s}},Kits:function(t,n,e){"use strict";function r(t,n,e){return n in t?Object.defineProperty(t,n,{value:e,enumerable:!0,configurable:!0,writable:!0}):t[n]=e,t}var i,a,o=e("LguZ"),u=e("lHQJ"),c=e("AezD"),s={tags:[],articles:[],isLoading:!0,articlesCount:0},l={articlesCount:function(t){return t.articlesCount},articles:function(t){return t.articles},isLoading:function(t){return t.isLoading},tags:function(t){return t.tags}},f=(i={},r(i,u.u,function(t,n){var e=t.commit;return e(c.k),o.b.query(n.type,n.filters).then(function(t){var n=t.data;e(c.l,n)}).catch(function(t){throw new Error(t)})}),r(i,u.v,function(t){var n=t.commit;return o.e.get().then(function(t){var e=t.data;n(c.m,e.tags)}).catch(function(t){throw new Error(t)})}),i),m=(a={},r(a,c.k,function(t){t.isLoading=!0}),r(a,c.l,function(t,n){var e=n.articles,r=n.articlesCount;t.articles=e,t.articlesCount=r,t.isLoading=!1}),r(a,c.m,function(t,n){t.tags=n}),r(a,c.d,function(t,n){t.articles=t.articles.map(function(t){return t.slug!==n.slug?t:(t.favorited=n.favorited,t.favoritesCount=n.favoritesCount,t)})}),a);n.a={state:s,getters:l,actions:f,mutations:m}},LguZ:function(t,n,e){"use strict";e.d(n,"e",function(){return f}),e.d(n,"b",function(){return m}),e.d(n,"c",function(){return d}),e.d(n,"d",function(){return v});var r=e("7+uW"),i=e("mtWM"),a=e.n(i),o=e("Rf8U"),u=e.n(o),c=e("5MmI"),s=e("wYMm"),l={init:function(){r.a.use(u.a,a.a),r.a.axios.defaults.baseURL=s.a},setHeader:function(){r.a.axios.defaults.headers.common.Authorization="Token "+c.a.getToken()},query:function(t,n){return r.a.axios.get(t,n).catch(function(t){throw new Error("[RWV] ApiService "+t)})},get:function(t){var n=arguments.length>1&&void 0!==arguments[1]?arguments[1]:"";return r.a.axios.get(t+"/"+n).catch(function(t){throw new Error("[RWV] ApiService "+t)})},post:function(t,n){return r.a.axios.post(""+t,n)},update:function(t,n,e){return r.a.axios.put(t+"/"+n,e)},put:function(t,n){return r.a.axios.put(""+t,n)},delete:function(t){return r.a.axios.delete(t).catch(function(t){throw new Error("[RWV] ApiService "+t)})}};n.a=l;var f={get:function(){return l.get("tags")}},m={query:function(t,n){return l.query("articles"+("feed"===t?"/feed":""),{params:n})},get:function(t){return l.get("articles",t)},create:function(t){return l.post("articles",{article:t})},update:function(t,n){return l.update("articles",t,{article:n})},destroy:function(t){return l.delete("articles/"+t)}},d={get:function(t){if("string"!=typeof t)throw new Error("[RWV] CommentsService.get() article slug required to fetch comments");return l.get("articles",t+"/comments")},post:function(t,n){return l.post("articles/"+t+"/comments",{comment:{body:n}})},destroy:function(t,n){return l.delete("articles/"+t+"/comments/"+n)}},v={add:function(t){return l.post("articles/"+t+"/favorite")},remove:function(t){return l.delete("articles/"+t+"/favorite")}}},M93x:function(t,n,e){"use strict";function r(t){e("RB0i")}var i=e("xJD8"),a=e("IMtK"),o=e("XyMi"),u=r,c=e.i(o.a)(i.a,a.a,a.b,!1,u,null,null);n.a=c.exports},NHnr:function(t,n,e){"use strict";Object.defineProperty(n,"__esModule",{value:!0});var r=e("7+uW"),i=e("M93x"),a=e("YaEn"),o=e("IcnI"),u=e("lHQJ"),c=e("LguZ"),s=e("GTdA"),l=e("hgdF");r.a.config.productionTip=!1,r.a.filter("date",s.a),r.a.filter("error",l.a),c.a.init(),a.a.beforeEach(function(t,n,e){return Promise.all([o.a.dispatch(u.a)]).then(e)}),new r.a({el:"#app",router:a.a,store:o.a,template:"<App/>",components:{App:i.a}})},RB0i:function(t,n){},UVMV:function(t,n,e){"use strict";n.a={name:"rwvFooter"}},YaEn:function(t,n,e){"use strict";var r=e("7+uW"),i=e("/ocq");r.a.use(i.a),n.a=new i.a({routes:[{path:"/",component:function(){return e.e(6).then(e.bind(null,"j7e0"))},children:[{path:"",name:"home",component:function(){return e.e(5).then(e.bind(null,"Ff+O"))}},{path:"my-feed",name:"home-my-feed",component:function(){return e.e(4).then(e.bind(null,"2Om/"))}},{path:"tag/:tag",name:"home-tag",component:function(){return e.e(3).then(e.bind(null,"kzGc"))}}]},{name:"login",path:"/login",component:function(){return e.e(11).then(e.bind(null,"lmfZ"))}},{name:"register",path:"/register",component:function(){return e.e(9).then(e.bind(null,"tcoL"))}},{name:"settings",path:"/settings",component:function(){return e.e(8).then(e.bind(null,"VKKr"))}},{path:"/@:username",component:function(){return e.e(10).then(e.bind(null,"Twgf"))},children:[{path:"",name:"profile",component:function(){return e.e(2).then(e.bind(null,"bzRz"))}},{name:"profile-favorites",path:"favorites",component:function(){return e.e(1).then(e.bind(null,"2XD+"))}}]},{name:"article",path:"/articles/:slug",component:function(){return e.e(0).then(e.bind(null,"UbIS"))},props:!0},{name:"article-edit",path:"/editor/:slug?",props:!0,component:function(){return e.e(7).then(e.bind(null,"tFGQ"))}}]})},hgdF:function(t,n,e){"use strict";n.a=function(t){return""+t[0]}},iNIO:function(t,n,e){"use strict";e.d(n,"a",function(){return r}),e.d(n,"b",function(){return i});var r=function(){var t=this,n=t.$createElement,e=t._self._c||n;return e("nav",{staticClass:"navbar navbar-light"},[e("div",{staticClass:"container"},[e("router-link",{staticClass:"navbar-brand",attrs:{to:{name:"home"}}},[t._v("\n      conduit\n    ")]),t._v(" "),t.isAuthenticated?e("ul",{staticClass:"nav navbar-nav pull-xs-right"},[e("li",{staticClass:"nav-item"},[e("router-link",{staticClass:"nav-link",attrs:{"active-class":"active",exact:"",to:{name:"home"}}},[t._v("\n          Home\n        ")])],1),t._v(" "),e("li",{staticClass:"nav-item"},[e("router-link",{staticClass:"nav-link",attrs:{"active-class":"active",to:{name:"article-edit"}}},[e("i",{staticClass:"ion-compose"}),t._v(" New Article\n        ")])],1),t._v(" "),e("li",{staticClass:"nav-item"},[e("router-link",{staticClass:"nav-link",attrs:{"active-class":"active",exact:"",to:{name:"settings"}}},[e("i",{staticClass:"ion-gear-a"}),t._v(" Settings\n        ")])],1),t._v(" "),t.currentUser.username?e("li",{staticClass:"nav-item"},[e("router-link",{staticClass:"nav-link",attrs:{"active-class":"active",exact:"",to:{name:"profile",params:{username:t.currentUser.username}}}},[t._v("\n          "+t._s(t.currentUser.username)+"\n        ")])],1):t._e()]):e("ul",{staticClass:"nav navbar-nav pull-xs-right"},[e("li",{staticClass:"nav-item"},[e("router-link",{staticClass:"nav-link",attrs:{"active-class":"active",exact:"",to:{name:"home"}}},[t._v("\n          Home\n        ")])],1),t._v(" "),e("li",{staticClass:"nav-item"},[e("router-link",{staticClass:"nav-link",attrs:{"active-class":"active",exact:"",to:{name:"login"}}},[e("i",{staticClass:"ion-compose"}),t._v("Sign in\n        ")])],1),t._v(" "),e("li",{staticClass:"nav-item"},[e("router-link",{staticClass:"nav-link",attrs:{"active-class":"active",exact:"",to:{name:"register"}}},[e("i",{staticClass:"ion-compose"}),t._v("Sign up\n        ")])],1)])],1)])},i=[]},itPX:function(t,n,e){"use strict";function r(t,n,e){return n in t?Object.defineProperty(t,n,{value:e,enumerable:!0,configurable:!0,writable:!0}):t[n]=e,t}var i,a,o=e("LguZ"),u=e("5MmI"),c=e("lHQJ"),s=e("AezD"),l={errors:null,user:{},isAuthenticated:!!u.a.getToken()},f={currentUser:function(t){return t.user},isAuthenticated:function(t){return t.isAuthenticated}},m=(i={},r(i,c.q,function(t,n){return new Promise(function(e){o.a.post("users/login",{user:n}).then(function(n){var r=n.data;t.commit(s.h,r.user),e(r)}).catch(function(n){var e=n.response;t.commit(s.i,e.data.errors)})})}),r(i,c.r,function(t){t.commit(s.j)}),r(i,c.s,function(t,n){return new Promise(function(e,r){o.a.post("users",{user:n}).then(function(n){var r=n.data;t.commit(s.h,r.user),e(r)}).catch(function(n){var e=n.response;t.commit(s.i,e.data.errors)})})}),r(i,c.a,function(t){u.a.getToken()?(o.a.setHeader(),o.a.get("user").then(function(n){var e=n.data;t.commit(s.h,e.user)}).catch(function(n){var e=n.response;t.commit(s.i,e.data.errors)})):t.commit(s.j)}),r(i,c.t,function(t,n){var e=n.email,r=n.username,i=n.password,a=n.image,u=n.bio,c={email:e,username:r,bio:u,image:a};return i&&(c.password=i),o.a.put("user",c).then(function(n){var e=n.data;return t.commit(s.h,e.user),e})}),i),d=(a={},r(a,s.i,function(t,n){t.errors=n}),r(a,s.h,function(t,n){t.isAuthenticated=!0,t.user=n,t.errors={},u.a.saveToken(t.user.token)}),r(a,s.j,function(t){t.isAuthenticated=!1,t.user={},t.errors={},u.a.destroyToken()}),a);n.a={state:l,actions:m,mutations:d,getters:f}},lHQJ:function(t,n,e){"use strict";e.d(n,"k",function(){return r}),e.d(n,"l",function(){return i}),e.d(n,"m",function(){return a}),e.d(n,"n",function(){return o}),e.d(n,"o",function(){return u}),e.d(n,"p",function(){return c}),e.d(n,"a",function(){return s}),e.d(n,"g",function(){return l}),e.d(n,"h",function(){return f}),e.d(n,"i",function(){return m}),e.d(n,"j",function(){return d}),e.d(n,"e",function(){return v}),e.d(n,"u",function(){return p}),e.d(n,"f",function(){return h}),e.d(n,"b",function(){return g}),e.d(n,"c",function(){return b}),e.d(n,"d",function(){return w}),e.d(n,"v",function(){return k}),e.d(n,"q",function(){return C}),e.d(n,"r",function(){return _}),e.d(n,"s",function(){return A}),e.d(n,"t",function(){return y});var r="publishArticle",i="deleteArticle",a="editArticle",o="addTagToArticle",u="removeTagFromArticle",c="resetArticleState",s="checkAuth",l="createComment",f="destroyComment",m="addFavorite",d="removeFavorite",v="fetchArticle",p="fetchArticles",h="fetchComments",g="fetchProfile",b="fetchProfileFollow",w="fetchProfileUnfollow",k="fetchTags",C="login",_="logout",A="register",y="updateUser"},wYMm:function(t,n,e){"use strict";e.d(n,"a",function(){return r});var r="https://conduit.productionready.io/api"},xJD8:function(t,n,e){"use strict";var r=e("BVEk"),i=e("GyQG");n.a={name:"App",components:{RwvHeader:r.a,RwvFooter:i.a}}}},[0]);
//# sourceMappingURL=app.22dbafb6873388a7830d.js.map