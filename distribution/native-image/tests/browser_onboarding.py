"""Browser acceptance for native onboarding with simulated Core REST and WebSocket responses."""
from pathlib import Path
from shutil import which
import json
from playwright.sync_api import sync_playwright, expect
root=Path('distribution/native-image/web')
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=which("google-chrome") or which("chromium"),args=['--no-sandbox'])
 ctx=browser.new_context(locale='en-US')
 page=ctx.new_page()
 done=set()
 events=[]
 transport={}
 device={"entity_id":"light.test","name":"Desk lamp","area_id":"desk","available_controls":["brightness","toggle"],"controls":["brightness"]}
 failed=[True]
 def route(r):
  req=r.request; path=req.url.split('stevora.test')[1].split('?')[0]
  def reply(x,status=200): r.fulfill(status=status,json=x)
  if path=='/api/onboarding':
   if failed and failed.pop(): return reply({},503)
   return reply([dict(step=k,done=k in done) for k in ('user','core_config','analytics','integration')])
  if path.startswith('/api/onboarding/'):
   key=path.split('/')[-1]
   if key=='users':
    assert 'user' not in done and req.post_data_json['name']=='Owner'
    done.add('user');return reply({'auth_code':'test-code'})
   assert req.headers.get('authorization')=='Bearer mock-access'
   done.add(key);return reply({})
  if path=='/auth/token': return reply(dict(access_token='mock-access',refresh_token='mock-refresh',expires_in=1800))
  if path=='/auth/providers':return reply([])
  if path.startswith('/api/hassio_ingress/'):
   assert 'ingress_session=mock-session' in req.headers.get('cookie','') or 'ingress_session=mock-session' in req.all_headers().get('cookie','')
   return r.fulfill(content_type='text/html',body='<h1>Test app</h1>')
  f=root/(path.lstrip('/') or 'index.html')
  if f.is_file():return r.fulfill(path=str(f.resolve()))
  reply({},404)
 page.route('http://stevora.test/**',route)
 def ws(sock):
  transport['socket']=sock
  sock.send(json.dumps({'type':'auth_required'}))
  def msg(raw):
   m=json.loads(raw); typ=m['type']
   if typ=='auth':return sock.send(json.dumps({'type':'auth_ok','ha_version':'test'}))
   events.append(m)
   vals={'auth/current_user':{'id':'owner','name':'Owner','is_admin':True},'get_config':dict(location_name='Home',latitude=42,longitude=25,time_zone='Europe/Sofia'),'stevora/os/v1/manifest':dict(installation_id='test',entities=[],rooms=[]),'conversation/agent/list':{'agents':[]}}
   if typ=='stevora/os/v1/manifest/subscribe': transport['subscription']=m['id']
   vals['stevora/os/v1/manifest']={'installation_id':'test','entities':[device],'rooms':[{'id':'desk','name':'Desk'}],'controllable_entities':['light.test']}
   vals['get_states']=[{'entity_id':'light.test','state':'on','attributes':{'brightness':128}}]
   vals['auth/long_lived_access_token']='mock-scoped-token'
   vals['supervisor/ingress/info']={'ingress_url':'/api/hassio_ingress/mock/'}
   vals['supervisor/ingress/session']={'session':'mock-session'}
   if typ=='supervisor/api':
    endpoint=m['endpoint']
    vals[typ]={
     '/addons':{'addons':[{'name':'Terminal','slug':'test_terminal','state':'started','ingress':True}]},
     '/store':{'addons':[]},
     '/addons/test_terminal/info':{'name':'Terminal','options':{'port':22}},
     '/addons/test_terminal/options/validate':{'valid':m.get('data')=={'port':2222}},
    }.get(endpoint,{})
   sock.send(json.dumps(dict(id=m['id'],type='result',success=True,result=vals.get(typ,[]))))
  sock.on_message(msg)
 page.route_web_socket('**/api/websocket',ws)
 page.goto('http://stevora.test/')
 expect(page.get_by_role('heading',name='Preparing STEVORA OS')).to_be_visible()
 page.get_by_label('Display name').fill('Owner',timeout=15000)
 page.get_by_label('Username').fill('owner')
 page.get_by_label('Password',exact=True).fill('test-only-one')
 page.get_by_label('Confirm password').fill('wrong')
 page.get_by_role('button',name='Create account').click()
 expect(page.get_by_role('alert')).to_contain_text('Passwords do not match')
 page.get_by_label('Confirm password').fill('test-only-one')
 page.get_by_role('button',name='Create account').click()
 expect(page.get_by_label('Home name')).to_be_visible()
 page.reload()
 page.get_by_label('Home name').fill('New home')
 page.get_by_role('button',name='Save home').click()
 page.get_by_role('button',name='Continue').click()
 page.get_by_role('button',name='Enter home').click()
 expect(page.locator('body')).not_to_have_class('setup-mode')
 assert done=={'user','core_config','analytics','integration'},done
 assert any(m['type']=='config/core/update' and m['location_name']=='New home' for m in events)
 assert any(m['type']=='analytics/preferences' and m['preferences']=={'base':False} for m in events)
 assert 'test-only-one' not in page.evaluate('JSON.stringify(sessionStorage)')
 page.locator('[data-view="devices"]').click()
 expect(page.get_by_role('button',name='Details',exact=True)).to_have_count(0)
 page.get_by_role('button',name='Desk lamp',exact=True).click()
 dialog=page.get_by_role('dialog')
 expect(dialog.get_by_role('heading',name='Desk lamp')).to_be_visible()
 slider=dialog.get_by_role('slider')
 slider.fill('25')
 slider.dispatch_event('change')
 expect(dialog.get_by_role('button',name='Toggle')).to_have_count(0)
 page.mouse.click(3, 3)
 expect(dialog).to_have_count(0)
 assert any(e.get('service_data')=={'brightness_pct':25} and e['target']=={'entity_id':'light.test'} for e in events)
 device['name']='Renamed from mobile'
 transport['socket'].send(json.dumps({'type':'event','id':transport['subscription'],'event':{'manifest_changed':True}}))
 expect(page.get_by_text('Renamed from mobile',exact=True)).to_be_visible()
 page.locator('[data-view="users"]').click()
 page.get_by_role('button',name='Generate long-lived access token').click()
 page.get_by_label('Application name').fill('Device test')
 page.get_by_role('button',name='Generate',exact=True).click()
 expect(page.get_by_label('Access token')).to_have_value('mock-scoped-token')
 page.get_by_role('button',name='Done',exact=True).click()
 assert 'mock-scoped-token' not in page.evaluate('JSON.stringify(sessionStorage)+JSON.stringify(localStorage)')
 page.locator('[data-view="apps"]').click()
 page.locator('[data-addon-action="options"]').click()
 page.get_by_label('port',exact=True).fill('2222')
 page.get_by_role('button',name='Save',exact=True).click()
 expect(page.get_by_role('dialog')).to_have_count(0)
 assert any(m.get('endpoint')=='/addons/test_terminal/options' and m.get('data')=={'options':{'port':2222}} for m in events)
 page.locator('[data-addon-action="open"]').click()
 expect(page.get_by_role('heading',name='Test app')).to_be_visible()
 page.evaluate('sessionStorage.clear()');page.goto('http://stevora.test/')
 expect(page.get_by_role('button',name='Sign in to STEVORA')).to_be_visible()
 # A completed Home Assistant onboarding responds 404, while modern
 # /auth/providers returns an object, not a top-level array. This must not
 # leave STEVORA indefinitely waiting for Core after a VM restart.
 def completed_route(route):
  path=route.request.url.split('stevora.test')[1].split('?')[0]
  if path=='/api/onboarding':
   return route.fulfill(status=404,json={'message':'Not Found'})
  if path=='/auth/providers':
   return route.fulfill(json={'providers':[{'name':'Home Assistant Local','type':'homeassistant'}],
                              'preselect_remember_me':False})
  return route.continue_()
 page.route('http://stevora.test/api/onboarding',completed_route)
 page.route('http://stevora.test/auth/providers',completed_route)
 page.reload()
 expect(page.get_by_role('button',name='Sign in to STEVORA')).to_be_visible(timeout=12000)
 page.get_by_role('button',name='Change language').click()
 expect(page.get_by_role('button',name='Вход в STEVORA')).to_be_visible()
 print('PASS: Core unavailable, owner validation and creation, token exchange, authenticated resume, home configuration, privacy choice, manifest, home, existing-home login BG/EN')
 browser.close()
