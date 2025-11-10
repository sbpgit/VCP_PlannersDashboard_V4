sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/Device",
    "vcp/vcplannerdashboard/model/models"
], (UIComponent,Device, models) => {
    "use strict";

    return UIComponent.extend("vcp.vcplannerdashboard.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // set the device model
            this.setModel(models.createDeviceModel(), "device");

            // enable routing
            this.getRouter().initialize();
             var oRootPath = jQuery.sap.getModulePath("vcp.vcplannerdashboard");
            var oImageModel = new sap.ui.model.json.JSONModel({ path: oRootPath });
            this.setModel(oImageModel, "imageModel"); 
            function loadScript(src) {
                    return new Promise((resolve, reject) => {
                        const script = document.createElement('script');
                        script.src = src;
                        script.onload = resolve;
                        script.onerror = reject;
                        document.head.appendChild(script);
                    });
                }

                (async function loadAllScripts() {
                    try {
                        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.11.4/jquery-ui.min.js');
                        console.log('jQuery UI loaded');

                        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jqueryui-touch-punch/0.2.3/jquery.ui.touch-punch.min.js');
                        console.log('Touch Punch loaded');

                        await loadScript('https://cdn.plot.ly/plotly-basic-latest.min.js');
                        console.log('Plotly Basic loaded');

                        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pivottable/2.22.0/pivot.min.js');
                        console.log('PivotTable loaded');

                        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pivottable/2.22.0/plotly_renderers.min.js');
                        console.log('Plotly Renderers loaded');

                        // Safe to initialize pivot now
                        // e.g. $("#output").pivotUI(...)
                    } catch (e) {
                        console.error('Failed to load a script:', e);
                    }
                })();
        }
    });
});