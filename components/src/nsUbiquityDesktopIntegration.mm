#include <Carbon/Carbon.h>
#include <AppKit/NSApplication.h>
#include <ApplicationServices/ApplicationServices.h>

#include "nsServiceManagerUtils.h"
#include "nsStringAPI.h"
#include "nsIObserverService.h"
#include "nsUbiquityDesktopIntegration.h"

NS_IMPL_ISUPPORTS1(nsUbiquityDesktopIntegration,
                   nsIUbiquityDesktopIntegration)

static nsISupports *gSingleton;
static EventHotKeyRef gMyHotKeyRef;
static EventHotKeyID gMyHotKeyID;
static EventHandlerRef gEventHandlerRef;

// TODO: This class should really be a singleton that's accessed
// through the service manager.

nsUbiquityDesktopIntegration::nsUbiquityDesktopIntegration()
{
  /* member initializers and constructor code */
}

nsUbiquityDesktopIntegration::~nsUbiquityDesktopIntegration()
{
  /* destructor code */
}

// This is called by the operating system in what I believe is the 
// main thread of Firefox, which I believe is also the UI thread.
// Hopefully it's ok to use XPCOM here--in any case, Firefox doesn't
// crash when we use it, so we're hopefully doing everything right!
// - A.V.
static OSStatus HotKeyHandler(EventHandlerCallRef nextHandler,
                              EventRef theEvent,
                              void *userData) {
  nsresult rv;
  nsCOMPtr<nsIObserverService>                                        \
      obSvc(do_GetService(NS_OBSERVERSERVICE_CONTRACTID, &rv));

  // TODO: Do something?
  if (NS_FAILED(rv)) {};

  rv = obSvc->NotifyObservers(gSingleton,
                              "ubiquity:hotkey",
                              NS_LITERAL_STRING("keypress").get());

  // TODO: Do something?
  if (NS_FAILED(rv)) {}

  return noErr;
}

NS_IMETHODIMP nsUbiquityDesktopIntegration::RegisterGlobalHotkey(
  PRInt32 keyCode,
  PRInt32 modifiers
  )
{
  if (gSingleton)
    return NS_ERROR_FAILURE;

  OSStatus result;

  EventTypeSpec eventType;
  eventType.eventClass=kEventClassKeyboard;
  eventType.eventKind=kEventHotKeyPressed;
  result = InstallEventHandler(GetApplicationEventTarget(),
                               &HotKeyHandler,
                               1,
                               &eventType,
                               NULL,
                               &gEventHandlerRef);
  if (result != noErr)
    return NS_ERROR_FAILURE;

  gMyHotKeyID.signature='htk1';
  gMyHotKeyID.id=1;
  result = RegisterEventHotKey(keyCode, modifiers, gMyHotKeyID, 
                               GetApplicationEventTarget(), 0,
                               &gMyHotKeyRef);
  if (result != noErr) {
    RemoveEventHandler(gEventHandlerRef);
    return NS_ERROR_FAILURE;
  }

  this->AddRef();
  gSingleton = this;

  return NS_OK;
}

NS_IMETHODIMP nsUbiquityDesktopIntegration::UnregisterGlobalHotkey()
{
  if (!gSingleton)
    return NS_ERROR_FAILURE;

  gSingleton = NULL;
  this->Release();
  if (UnregisterEventHotKey(gMyHotKeyRef) != noErr)
    return NS_ERROR_FAILURE;
  if (RemoveEventHandler(gEventHandlerRef) != noErr)
    return NS_ERROR_FAILURE;
  return NS_OK;
}

NS_IMETHODIMP nsUbiquityDesktopIntegration::BringAppToForeground()
{
  NSApplication *sharedApp = [NSApplication sharedApplication];
  [sharedApp activateIgnoringOtherApps: YES];
  return NS_OK;
}

NS_IMETHODIMP nsUbiquityDesktopIntegration::DeactivateApp()
{
  NSApplication *sharedApp = [NSApplication sharedApplication];
  [sharedApp deactivate];
  return NS_OK;
}

NS_IMETHODIMP nsUbiquityDesktopIntegration::HideApp()
{
  NSApplication *sharedApp = [NSApplication sharedApplication];
  [sharedApp hide: sharedApp];
  return NS_OK;
}

NS_IMETHODIMP nsUbiquityDesktopIntegration::UnhideAppWithoutActivation()
{
  NSApplication *sharedApp = [NSApplication sharedApplication];
  [sharedApp unhideWithoutActivation];
  return NS_OK;
}

NS_IMETHODIMP nsUbiquityDesktopIntegration::IsAppActive(PRBool *isActive)
{
  NSApplication *sharedApp = [NSApplication sharedApplication];
  *isActive = [sharedApp isActive];
  return NS_OK;
}

NS_IMETHODIMP nsUbiquityDesktopIntegration::SwitchToLastApp()
{
  // Simulate the pressing of alt-tab.

  CGEventRef events[2];
  events[0] = CGEventCreateKeyboardEvent(NULL, (CGKeyCode) 48, true);
  if (events[0] == NULL)
    return NS_ERROR_FAILURE;
  CGEventSetFlags(events[0], kCGEventFlagMaskCommand);

  events[1] = CGEventCreateKeyboardEvent(NULL, (CGKeyCode) 48, false);
  if (events[1] == NULL)
    return NS_ERROR_FAILURE;
  CGEventSetFlags(events[1], kCGEventFlagMaskCommand);

  CGEventTapLocation loc = kCGHIDEventTap;
  CGEventPost(loc, events[0]);
  CGEventPost(loc, events[1]);

  CFRelease(events[0]);
  CFRelease(events[1]);
  return NS_OK;
}

NS_IMETHODIMP nsUbiquityDesktopIntegration::ClickAt(PRInt32 x,
                                                    PRInt32 y)
{
  // Simulate a mouse click.

  CGPoint point;
  point.x = 5;
  point.y = 30;
  CGEventRef events[2];
  events[0] = CGEventCreateMouseEvent(
    NULL,
    kCGEventLeftMouseDown,
    point,
    NULL
    );
  if (events[0] == NULL)
    return NS_ERROR_FAILURE;
  CGEventSetFlags(events[0], 0);

  events[1] = CGEventCreateMouseEvent(
    NULL,
    kCGEventLeftMouseUp,
    point,
    NULL
    );
  if (events[1] == NULL)
    return NS_ERROR_FAILURE;
  CGEventSetFlags(events[1], 0);

  CGEventTapLocation loc = kCGHIDEventTap;
  CGEventPost(loc, events[0]);
  CGEventPost(loc, events[1]);

  CFRelease(events[0]);
  CFRelease(events[1]);
  return NS_OK;
}
