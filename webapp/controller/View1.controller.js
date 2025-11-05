sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "../model/formatter",
    'sap/ui/core/Fragment'
], (Controller, JSONModel, MessageToast, MessageBox, Filter,
    FilterOperator, formatter, Fragment) => {
    "use strict";
    var that;
    return Controller.extend("vcp.vcplannerdashboard.controller.View1", {
        formatter: formatter,
        onInit: function () {
            this.oModel = this.getOwnerComponent().getModel();
            this.data = [];
            this.locationData = [];
            this.prodData = [];
            var sRootPath = jQuery.sap.getModulePath("vcp/vcplannerdashboard", "/");
            this.byId("idHeaderImage").setSrc(sRootPath + "image/logo.png");
            this.getLocationData();
        },
        onAfterRendering: async function () {
            sap.ui.core.BusyIndicator.show()
            that = this;
            that.oGModel = that.getOwnerComponent().getModel("oGModel");
            sap.ui.core.BusyIndicator.show();
            that.viewDetails = new JSONModel();
            that.viewDetails.setSizeLimit(5000);
            that.variantModel = new JSONModel();
            that.variantModel.setSizeLimit(5000);
            this.data = [];
            this.locationData = [];
            this.prodData = [];
            that.newChartData = [];
            that.CalendarData = [], that.assemblyData = [], that.cardData = [],
                that.totalAssemblyData = [], that.forecastData = [], that.totalOptMixData = [], that.monthData = [];
            that.rtrLineData = [], that.prdDmdData = [], that.wowData = [];
            this.getLocProd();
            // this._showEmptyAlertsCard("WOW Variance", "MyCardIdFore");
            await this.loadAlertsCards();
            this.getVariantData();
        },
        getLocationData: async function () {
            const iPageSize = 5000; // tune this depending on your service
            let iSkip = 0;
            let aAllResults = [];
            let bHasMore = true;

            while (bHasMore) {
                const aContexts = await this.oModel
                    .bindList("/getLocation")
                    .requestContexts(iSkip, iPageSize);

                const aPageResults = aContexts.map(ctx => ctx.getObject());

                aAllResults = aAllResults.concat(aPageResults);

                // If we got less than requested, it's the last page
                if (aPageResults.length < iPageSize) {
                    bHasMore = false;
                } else {
                    iSkip += iPageSize;
                }
            }
            console.log("Total records loaded:", aAllResults.length);
            if (aAllResults.length === 0) {
                sap.m.MessageToast.show("No data available for all Locations");
            } else {
                that.oGModel.setProperty("/fullLocData", aAllResults);
            }
        },
        // v4 oData
        getLocProd: async function () {
            const iPageSize = 5000; // tune this depending on your service
            let iSkip = 0;
            let aAllResults = [];
            let bHasMore = true;

            while (bHasMore) {
                const aContexts = await this.oModel
                    .bindList("/getfactorylocdesc")
                    .requestContexts(iSkip, iPageSize);

                const aPageResults = aContexts.map(ctx => ctx.getObject());
                aAllResults = aAllResults.concat(aPageResults);
                // If we got less than requested, it's the last page
                if (aPageResults.length < iPageSize) {
                    bHasMore = false;
                } else {
                    iSkip += iPageSize;
                }
            }
            console.log("Total records loaded:", aAllResults.length);
            if (aAllResults.length === 0) {
                sap.m.MessageToast.show("No data available in demand location and products");
            } else {
                that.oGModel.setProperty("/fullLocProdData", aAllResults);
                this.processData(aAllResults);
                sap.ui.core.BusyIndicator.hide();
            }
        },

        processData: function (results) {
            // Remove duplicates and sort
            this.locationData = this.removeDuplicates(results, "DEMAND_LOC");
            this.locationData.sort((a, b) => a.DEMAND_DESC.localeCompare(b.DEMAND_DESC));

            this.prodData = this.removeDuplicates(results, "PRODUCT_ID");
            this.prodData.sort((a, b) => a.PROD_DESC.localeCompare(b.PROD_DESC));

            // Set models
            this.getView().setModel(
                new sap.ui.model.json.JSONModel({ results1: this.locationData }),
                "locModel"
            );
            this.getView().setModel(
                new sap.ui.model.json.JSONModel({ results2: this.prodData }),
                "prodModel"
            );

            // Clear selections
            this.byId("LocationSelect").setSelectedKey("");
            this.byId("productSelect").setSelectedKey("");

            // Load cards
            this._loadForecastCard();
            // this.loadProcessAlertsCard();
        },

        // Remove duplicates based on a specific key
        removeDuplicates: function (data, key) {
            const seen = new Set();
            return data.filter(item => {
                const value = item[key];
                if (seen.has(value)) {
                    return false;
                }
                seen.add(value);
                return true;
            });
        },

        // -------------------
        // Load Forecast Data
        // -------------------
        _loadForecastCard: function () {
            const oModel = this.getOwnerComponent().getModel();
            const oCard = this.byId("MyCardId2");
            if (oCard) oCard.setBusy(true);
            if (!oModel) {
                console.error("OData model not available");
                return;
            }

            // Get selected keys
            const locSelectedKey = this.byId("LocationSelect").getSelectedKey();
            const prodSelectedKey = this.byId("productSelect").getSelectedKey();

            // Build filter array for OData V4
            const aFilters = [];

            if (locSelectedKey) {
                aFilters.push(new sap.ui.model.Filter("LOCATION_ID", "EQ", locSelectedKey));
            }

            if (prodSelectedKey) {
                aFilters.push(new sap.ui.model.Filter("PRODUCT_ID", "EQ", prodSelectedKey));
            }

            // sap.ui.core.BusyIndicator.show();
            try {
                // Use bindList with filters, similar to your working example
                oModel.bindList("/getForecastSnapshotLag", null, [], aFilters)
                    .requestContexts()
                    .then((aContexts) => {
                        const results = aContexts.map(oContext => oContext.getObject());

                        if (Array.isArray(results) && results.length > 0) {
                            const chartData = this._prepareChartData(results);
                            const oManifest = this._buildCardManifest(
                                chartData,
                                "Forecast Snapshot Lag Analysis",
                                "Forecast",
                                results
                            );
                            this._applyCardManifest("MyCardId2", oManifest);
                        } else {
                            console.warn("No forecast data found for selected filters");
                            // sap.m.MessageToast.show("No forecast data available");
                            this._showEmptyAlertsCard("Forecast Snapshot Lag Analysis", "MyCardId2")
                        }
                    })
            } catch (error) {
                sap.m.MessageBox.error("Failed to load forecast data: " + (error.message || "Unknown error"));
            } finally {
                if (oCard) oCard.setBusy(false);
            }
        },


        // -------------------
        // Load Assembly Data
        // -------------------
        _loadAssemblyCard: function () {
            const oModel = this.getOwnerComponent().getModel();

            if (!oModel) {
                console.error("OData model not available");
                return;
            }

            const locSelectedKeyAsmb = this.byId("LocationSelect").getSelectedKey();
            const prodSelectedKeyAsmb = this.byId("productSelect").getSelectedKey();

            const aFilters = [];

            // Add filters only if values are selected
            if (locSelectedKeyAsmb) {
                aFilters.push(new sap.ui.model.Filter("LOCATION_ID", "EQ", locSelectedKeyAsmb));
            }

            if (prodSelectedKeyAsmb) {
                aFilters.push(new sap.ui.model.Filter("PRODUCT_ID", "EQ", prodSelectedKeyAsmb));
            }

            sap.ui.core.BusyIndicator.show();

            // OData V4 approach using bindContext
            const oBindingContext = oModel.bindContext("/getAssemblySnapshotLag", null, {
                filters: aFilters.length > 0 ? aFilters : undefined,
                operationMode: "Server"
            });

            oBindingContext.requestObject()
                .then((oData) => {
                    // OData V4 returns data in 'value' property
                    const results = oData.value || [];
                    if (results.length > 0) {
                        const chartData = this._prepareChartData(results);
                        const oManifest = this._buildCardManifest(
                            chartData,
                            "Assembly Snapshot Lag Analysis",
                            "Assembly",
                            results
                        );
                        this._applyCardManifest("MyCardId2", oManifest);
                    }
                    else {
                        this._showEmptyAlertsCard("Assembly Lag snapshot analysis", "MyCardId2")
                    }

                    sap.ui.core.BusyIndicator.hide();
                })
                .catch((oError) => {
                    sap.ui.core.BusyIndicator.hide();
                    console.error("Read failed for assembly:", oError);
                    sap.m.MessageBox.error("Failed to load assembly data: " + (oError.message || "Unknown error"));
                });
        },

        // -------------------
        // Utility: transform data into chart format
        // -------------------
        _prepareChartData: function (aResults) {
            if (!aResults || aResults.length === 0) return [];

            var periodMap = {};
            aResults.forEach(function (item) {
                var period = item.YEAR_MONTH;
                if (!periodMap[period]) {
                    periodMap[period] = {
                        period: period,
                        lag1Values: [], lag2Values: [], lag3Values: [],
                        lag4Values: [], lag5Values: []
                    };
                }
                if (item.LAG1_CIR != null) periodMap[period].lag1Values.push(parseFloat(item.LAG1_CIR));
                if (item.LAG2_CIR != null) periodMap[period].lag2Values.push(parseFloat(item.LAG2_CIR));
                if (item.LAG3_CIR != null) periodMap[period].lag3Values.push(parseFloat(item.LAG3_CIR));
                if (item.LAG4_CIR != null) periodMap[period].lag4Values.push(parseFloat(item.LAG4_CIR));
                if (item.LAG5_CIR != null) periodMap[period].lag5Values.push(parseFloat(item.LAG5_CIR));
            });

            var chartData = [];
            Object.keys(periodMap).sort().forEach(function (period) {
                var data = periodMap[period];
                chartData.push({
                    period: period,
                    lag1: data.lag1Values.length ? data.lag1Values.reduce((a, b) => a + b, 0) / data.lag1Values.length : 0,
                    lag2: data.lag2Values.length ? data.lag2Values.reduce((a, b) => a + b, 0) / data.lag2Values.length : 0,
                    lag3: data.lag3Values.length ? data.lag3Values.reduce((a, b) => a + b, 0) / data.lag3Values.length : 0,
                    lag4: data.lag4Values.length ? data.lag4Values.reduce((a, b) => a + b, 0) / data.lag4Values.length : 0,
                    lag5: data.lag5Values.length ? data.lag5Values.reduce((a, b) => a + b, 0) / data.lag5Values.length : 0
                });
            });

            return chartData;
        },

        // -------------------
        // Utility: build card manifest
        // -------------------
        _buildCardManifest: function (chartData, sTitle, sSelected, oData) {
            return {
                "sap.app": {
                    "id": "vcp.v4card.forecast",
                    "type": "card",
                    "applicationVersion": { "version": "1.0.0" }
                },
                "sap.ui": {
                    "technology": "UI5",
                    "deviceTypes": { "desktop": true, "tablet": true, "phone": true }
                },
                "sap.card": {
                    "type": "Analytical",
                    "data": { "json": chartData },
                    "header": {
                        "type": "Numeric",
                        "title": sTitle,
                        "subTitle": "Comparison across lag periods",
                        "mainIndicator": {
                            "number": chartData.length,
                            "unit": "Periods",
                            "state": "Good"
                        },
                        "sideIndicators": [
                            { "title": "Total Records", "number": oData.length, "unit": "Records" },
                            { "title": "Unique Periods", "number": chartData.length, "unit": "Months" }
                        ]
                    },
                    "configuration": {
                        "filters": {
                            "Lag": {
                                "type": "ComboBox",
                                "label": "Dataset",
                                "value": sSelected, // either "Forecast" or "Assembly"
                                "item": {
                                    "path": "/",
                                    "template": {
                                        "key": "{text}",
                                        "title": "{text}"
                                    }
                                },
                                "data": {
                                    "json": [
                                        { "text": "Forecast" },
                                        { "text": "Assembly" }
                                    ]
                                }
                            }
                        }
                    },
                    "content": {
                        "chartType": "column",
                        "title": { "text": sTitle },
                        "legend": { "visible": true },
                        "data": { "path": "/" },
                        "dimensions": [
                            { "label": "Period", "value": "{period}" }
                        ],
                        "measures": [
                            { "label": "Lag 1", "value": "{lag1}" },
                            { "label": "Lag 2", "value": "{lag2}" },
                            { "label": "Lag 3", "value": "{lag3}" },
                            { "label": "Lag 4", "value": "{lag4}" },
                            { "label": "Lag 5", "value": "{lag5}" }
                        ],
                        "feeds": [
                            { "uid": "categoryAxis", "type": "Dimension", "values": ["Period"] },
                            { "uid": "valueAxis", "type": "Measure", "values": ["Lag 1", "Lag 2", "Lag 3", "Lag 4", "Lag 5"] }
                        ]
                    }
                }
            };
        },
        // -------------------
        // Event: filter change
        // -------------------
        onFilterChange: function (oEvent) {
            var mChanges = oEvent.getParameters().changes;
            if (mChanges && mChanges["/sap.card/configuration/filters/Lag/value"]) {
                var selected = mChanges["/sap.card/configuration/filters/Lag/value"];
                console.log("Dropdown changed:", selected);

                if (selected === "Forecast") {
                    this._loadForecastCard();
                } else if (selected === "Assembly") {
                    this._loadAssemblyCard();
                }
            }
        },
        // -------------------
        // Utility: apply manifest and attach filter change
        // -------------------
        _applyCardManifest: function (sCardId, oManifest) {
            var oCard = this.byId(sCardId);
            if (oCard) {
                oCard.setManifest(oManifest);

                // attach configurationChange instead of filterChange
                oCard.detachConfigurationChange(this.onFilterChange, this);
                oCard.attachConfigurationChange(this.onFilterChange, this);
            }
            sap.ui.core.BusyIndicator.hide();
        },
        onLocationChange: function () {
            var selectedData = this.byId("LocationSelect").getSelectedKey();
            var filteredProdData = this.prodData.filter(a => a.DEMAND_LOC === selectedData);
            var oJSONProduct = new sap.ui.model.json.JSONModel({ results2: filteredProdData });
            this.getView().setModel(oJSONProduct, "prodModel");
        },
        onGetData: function () {
            this._loadForecastCard();
            this.loadAlertsCards();
            that.loadAllLags();
            this._loadCharCards();
        },
        onResetData: function () {
            sap.ui.core.BusyIndicator.show();
            const oAssemblyModel = new sap.ui.model.json.JSONModel({ Assembly: [] });
            this.getView().setModel(oAssemblyModel, "assembly");
            const calendarModel = new sap.ui.model.json.JSONModel({ MONTH: [] });
            that.getView().setModel(calendarModel, "calendar");
            const oModel = new sap.ui.model.json.JSONModel({ Factory_loc: [] });
            this.getView().setModel(oModel, "filters");
            that.byId("lagsPanel").setExpanded(false);
            this.byId("LocationSelect").setSelectedKey("");
            this.byId("productSelect").setSelectedKey("");
            //Reset asselbly lag
            that.onFilterResetAssembly();
            that.onFilterResetOptMix();
            that.onFilterResetRtr();
            that.onFilterResetPrdDmd();
            that.onFilterResetWOW();
            // that.loadAlertsCards();
            that.onAfterRendering();

        },

        // Main method to Data alerts using V4 OData
        loadAlertsCards: function () {
            var that = this;
            var oModel = this.getOwnerComponent().getModel(); // V4 OData model
            const locSelectedKey = this.byId("LocationSelect").getSelectedKey();
            const prodSelectedKey = this.byId("productSelect").getSelectedKey();

            // Build filter array for OData V4
            const aFilters = [];

            if (locSelectedKey) {
                aFilters.push(new sap.ui.model.Filter("LOCATION_ID", "EQ", locSelectedKey));
            }

            if (prodSelectedKey) {
                aFilters.push(new sap.ui.model.Filter("PRODUCT_ID", "EQ", prodSelectedKey));
            }

            // Use bindList and requestContexts for V4 OData
            oModel.bindList("/getPlannerAlerts", null, [], aFilters).requestContexts().then(function (aContexts) {
                console.log("[V4 Alerts] Received contexts:", aContexts);

                if (aContexts && aContexts.length > 0) {
                    // Extract data from V4 contexts
                    var rawData = aContexts.map(function (oContext) {
                        return oContext.getObject();
                    });
                    console.log("[V4 Alerts] Raw data:", rawData);

                    // Process the data using your existing logic
                    that._processAlertsDataV4(rawData);

                } else {
                    console.warn("[V4 Alerts] No data received -> show empty cards");
                    that._setEmptyAlertCards();
                }
            }).catch(function (oError) {
                console.error("[V4 Alerts] Error loading data:", oError);
                that._setEmptyAlertCards();
            });
        },


        // V4 OData data processing with all three cards
        _processAlertsDataV4: function (oData) {
            var that = this;

            // Normalize incoming V4 payload
            var results = [];
            try {
                results = Array.isArray(oData) ? oData : (oData.value || []);
            } catch (e) {
                console.error("[V4 Alerts] Error parsing data:", e);
                results = [];
            }

            console.log("[V4 Alerts] raw results length:", results.length);

            if (!results || results.length === 0) {
                console.warn("[V4 Alerts] No alerts -> show empty cards");
                that._setEmptyAlertCards();
                return;
            }

            // Keep only VCPLANNER alerts
            var vcAlerts = results.filter(function (it) {
                return it && it.APPL === "VCPLANNER";
            });

            if (vcAlerts.length === 0) {
                that._setEmptyAlertCards();
                return;
            }

            console.log("[V4 Alerts] All VCPLANNER alerts:", vcAlerts);

            // DATA ALERTS: Only MSGGRP = "DATA"
            var dataAlerts = vcAlerts.filter(function (a) {
                return a.MSGGRP === "PROCESS_JOBS";
            });

            // SYSTEM ALERTS: PROCESS_JOBS, INTERFACE, RESTRICTIONS
            var systemAlerts = vcAlerts.filter(function (a) {
                return a.MSGGRP === "PROCESS_JOBS" || a.MSGGRP === "INTERFACE" || a.MSGGRP === "RESTRICTIONS";
            });

            // EXCEPTIONAL ALERTS: Only MSGGRP = "EXCEPTIONAL"
            var exceptionalAlerts = vcAlerts.filter(function (a) {
                return a.MSGGRP === "DATA";
            });

            // EXCEPTIONAL ALERTS: Only MSGGRP = "EXCEPTIONAL"
            var interfaceAlerts = vcAlerts.filter(function (a) {
                return a.MSGGRP === "INTERFACE";
            });

            console.log("[V4 Alerts] Filtered - Data:", dataAlerts.length, "System:", systemAlerts.length, "Exception:", exceptionalAlerts.length);

            // Process DATA ALERTS card data - show individual messages
            var dataAlertsCardData = dataAlerts.map(function (a, idx) {
                return {
                    id: a.PROCESS_ID || a.MSGID || ("data-" + idx),
                    title: a.MSGTXT || "Data alert",
                    description: a.ADDL_INFO || "",
                    // icon: "sap-icon://activities",
                    severity: that._determineExceptionalSeverity(a.MSGTXT)
                };
            });

            // Process SYSTEM ALERTS card data - show grouped counts
            var systemGroups = {
                "PROCESS_JOBS": { count: 0, success: 0, warning: 0, error: 0 },
                "INTERFACE": { count: 0, success: 0, warning: 0, error: 0 },
                "RESTRICTIONS": { count: 0, success: 0, warning: 0, error: 0 }
            };

            systemAlerts.forEach(function (a) {
                var group = a.MSGGRP;
                if (systemGroups[group]) {
                    systemGroups[group].count += 1;
                    systemGroups[group].success += Number(a.SUCCESS_COUNT || 0);
                    systemGroups[group].warning += Number(a.WARNING_COUNT || 0);
                    systemGroups[group].error += Number(a.ERROR_COUNT || 0);
                }
            });

            // Convert to array format for the card
            var systemAlertsCardData = Object.keys(systemGroups).map(function (group) {
                var data = systemGroups[group];
                var displayNameMap = {
                    "PROCESS_JOBS": "Process Jobs",
                    "INTERFACE": "Interface",
                    "RESTRICTIONS": "Restrictions"
                };

                return {
                    category: displayNameMap[group] || group,
                    count: data.count,
                    success: data.success,
                    warning: data.warning,
                    error: data.error,
                    icon: that._getSystemGroupIcon(group),
                    severity: that._determineSystemSeverity(data.success, data.warning, data.error),
                    rawCategory: group
                };
            }).filter(function (item) {
                return item.count > 0; // Only show groups with alerts
            });

            // Process EXCEPTIONAL ALERTS card data - show individual messages
            var exceptionalAlertsCardData = exceptionalAlerts.map(function (a, idx) {
                return {
                    id: a.PROCESS_ID || a.MSGID || ("exceptional-" + idx),
                    title: a.MSGTXT || "Exception alert",
                    description: a.ADDL_INFO || "",
                    // icon: "sap-icon://alert",
                    severity: that._determineExceptionalSeverity(a.MSGTXT)
                };
            });

            var interfaceAlertsCardData = interfaceAlerts.map(function (a, idx) {
                return {
                    id: a.PROCESS_ID || a.MSGID || ("interface-" + idx),
                    title: a.MSGTXT || "Interface alert",
                    description: a.ADDL_INFO || "",
                    // icon: "sap-icon://connected",
                    severity: that._determineExceptionalSeverity(a.MSGTXT)
                };
            });

            console.log("[V4 Alerts] System groups data:", systemAlertsCardData);
            console.log("[V4 Alerts] Exception alerts:", exceptionalAlertsCardData);
            console.log("[V4 Alerts] Interface alerts:", interfaceAlertsCardData);

            // Bind to all three cards
            that._bindAlertsToCardsExact(dataAlertsCardData, systemAlertsCardData, exceptionalAlertsCardData, interfaceAlertsCardData);
        },

        // Binding method for all three cards
        _bindAlertsToCardsExact: function (dataAlertsCardData, systemAlertsCardData, exceptionalAlertsCardData, interfaceAlertsCardData) {
            var that = this;

            // Get card references
            var oSystemCard = that.byId("MyCardId");     // System Alerts (700px)
            var oDataCard = that.byId("MyCardId1");      // Data Alerts (350px)
            var oExceptionalCard = that.byId("MyCardId3"); // Exceptional Alerts (300px)
            var oInterfaceCard = that.byId("MyCardId4")
            try {
                // SYSTEM ALERTS CARD - Grouped counts
                if (oSystemCard) {
                    if (systemAlertsCardData.length === 0) {
                        that._showEmptyAlertsCard("System Alerts", "MyCardId");
                    } else {
                        oSystemCard.setManifest(
                            that._createSystemAlertsCardManifestExact(systemAlertsCardData)
                        );
                        // ✅ Attach the click event
                        oSystemCard.detachAction(this.onCardAction, this);
                        oSystemCard.attachAction(this.onCardAction, this);
                        console.log("[V4 Alerts] System card bound with", systemAlertsCardData.length, "groups");
                    }
                }

                // DATA ALERTS CARD - Individual messages
                if (oDataCard) {
                    if (dataAlertsCardData.length === 0) {
                        that._showEmptyAlertsCard("Data Alerts", "MyCardId1");
                    } else {
                        oDataCard.setManifest(
                            that._createDataAlertsCardManifestExact(dataAlertsCardData)
                        );
                        console.log("[V4 Alerts] Data card bound with", dataAlertsCardData.length, "alerts");
                    }
                }

                // EXCEPTIONAL ALERTS CARD - Individual messages with severity
                if (oExceptionalCard) {
                    if (exceptionalAlertsCardData.length === 0) {
                        that._showEmptyAlertsCard("Exception Alerts", "MyCardId3");
                    } else {
                        oExceptionalCard.setManifest(
                            that._createExceptionalAlertsCardManifest(exceptionalAlertsCardData)
                        );
                        console.log("[V4 Alerts] Exception card bound with", exceptionalAlertsCardData.length, "alerts");
                    }
                }

                // INTERFACE ALERTS CARD - Individual messages 
                if (oInterfaceCard) {
                    if (interfaceAlertsCardData.length === 0) {
                        that._showEmptyAlertsCard("Interface Alerts", "MyCardId4");
                    } else {
                        oInterfaceCard.setManifest(
                            that._createInterfaceAlertsCardManifest(interfaceAlertsCardData)
                        );
                        console.log("[V4 Alerts] Exception card bound with", interfaceAlertsCardData.length, "alerts");
                    }
                }

                console.log("[V4 Alerts] All three cards updated successfully");

            } catch (error) {
                console.error("[V4 Alerts] Error binding cards:", error);
                that._setEmptyAlertCards();
            }
        },

        // SYSTEM ALERTS CARD - Show grouped counts in exact format
        _createSystemAlertsCardManifestExact: function (data) {
            var safeData = data || [];
            data.forEach(item => {
                if (item.error > 0) item.state = "Error";
                else if (item.warning > 0) item.state = "Warning";
                else item.state = "Success";
                // item.targetApp = await this._getTargetForCategory(item.category);
                item.targetApp = item.category;
            });

            return {
                "sap.app": {
                    "id": "vcp.v4card.systemalerts",
                    "type": "card",
                    "applicationVersion": { "version": "1.0.0" }
                },
                "sap.ui": { "technology": "UI5" },
                "sap.card": {
                    "type": "List",
                    "data": {
                        "json": {
                            "items": safeData
                        }
                    },
                    "header": {
                        "title": "System Alerts",
                        "subTitle": "Process, Interface & Restriction Status",
                        "icon": {
                            "src": "sap-icon://process"
                        },
                        "status": {
                            "text": "",
                            "state": "{= ${error} > 0 ? 'Error' : ${warning} > 0 ? 'Warning' : 'Success' }"
                        }
                    },
                    "content": {
                        "data": {
                            "path": "/items"
                        },
                        "item": {
                            "title": "{category}",
                            "description": "{count} alert(s)",
                            "highlight": "{severity}",
                            "icon": { "src": "{icon}" },
                            "info": {
                                "value": "✅ {success} ⚠ {warning} ❌ {error}",
                                "state": "{= ${error} > 0 ? 'Error' : ${warning} > 0 ? 'Warning' : 'Success' }",

                            },

                            "actions": [
                                {
                                    "type": "Custom",
                                    "parameters": {
                                        "actionId": "{rawCategory}"
                                    }
                                }
                            ]
                        }
                    }
                }
            };
        },

        // DATA ALERTS CARD - Show individual messages
        _createDataAlertsCardManifestExact: function (data) {
            var safeData = data || [];


            return {
                "sap.app": {
                    "id": "vcp.v4card.dataalerts",
                    "type": "card",
                    "applicationVersion": { "version": "1.0.0" }
                },
                "sap.ui": { "technology": "UI5" },
                "sap.card": {
                    "type": "List",
                    "data": {
                        "json": {
                            "items": safeData
                        }
                    },
                    "header": {
                        "title": "Data Alerts",
                        "subTitle": "Issues in VC Planner data processing",
                        "icon": {
                            "src": "sap-icon://activities",
                            "width": "70px"
                        },
                        "status": {
                            "text": safeData.length + " alerts",
                            "state": safeData.length > 0 ? "Warning" : "Success"
                        }
                    },
                    "content": {
                        "data": {
                            "path": "/items"
                        },
                        "item": {
                            "title": "{title}",
                            "description": "{description}",
                            // "icon": { "src": "{icon}" }
                            "highlight": "{severity}"
                        }
                    },
                    "footer": {
                        "paginator": {
                            "pageSize": 7
                        }
                    }
                }
            };
        },

        // EXCEPTIONAL ALERTS CARD - Show individual messages with severity
        _createExceptionalAlertsCardManifest: function (data) {
            var safeData = data || [];

            return {
                "sap.app": {
                    "id": "vcp.v4card.exceptionalalerts",
                    "type": "card",
                    "applicationVersion": { "version": "1.0.0" }
                },
                "sap.ui": { "technology": "UI5" },
                "sap.card": {
                    "type": "List",
                    "data": {
                        "json": {
                            "items": safeData
                        }
                    },
                    "header": {
                        "title": "Exception Alerts",
                        "subTitle": "Critical exceptions",
                        "icon": {
                            "src": "sap-icon://critical-issue"
                        },
                        "status": {
                            "text": safeData.length + " alerts",
                            // "state": safeData.length > 0 ? "Error" : "Success"
                        }
                    },
                    "content": {
                        "data": {
                            "path": "/items"
                        },
                        "item": {
                            "title": "{title}",
                            "description": "{description}",
                            // "icon": { "src": "{icon}" },
                            "highlight": "{severity}"
                            // "info": {
                            //     "value": "{severity}",
                            //     "state": "{= ${severity} === 'High' ? 'Error' : ${severity} === 'Medium' ? 'Warning' : 'Information' }"
                            // }
                        }
                    },
                    "footer": {
                        "paginator": {
                            "pageSize": 7
                        }
                    }
                }
            };
        },

        // INTERFACE ALERTS CARD - Show individual messages 
        _createInterfaceAlertsCardManifest: function (data) {
            var safeData = data || [];

            return {
                "sap.app": {
                    "id": "vcp.v4card.exceptionalalerts",
                    "type": "card",
                    "applicationVersion": { "version": "1.0.0" }
                },
                "sap.ui": { "technology": "UI5" },
                "sap.card": {
                    "type": "List",
                    "data": {
                        "json": {
                            "items": safeData
                        }
                    },
                    "header": {
                        "title": "Interface Alerts",
                        "subTitle": "Interface system Alerts",
                        "icon": {
                            "src": "sap-icon://connected"
                        },
                        "status": {
                            "text": safeData.length + " alerts",
                        }
                    },
                    "content": {
                        "data": {
                            "path": "/items"
                        },
                        "item": {
                            "title": "{title}",
                            "description": "{description}",
                            // "icon": { "src": "{icon}" },
                            "highlight": "{severity}"
                        }
                    },
                    "footer": {
                        "paginator": {
                            "pageSize": 7
                        }
                    }
                }
            };
        },

        // Determine severity for exceptional alerts
        _determineExceptionalSeverity: function (message) {
            if (!message) return "Information";

            var lowerMessage = message.toLowerCase();
            if (lowerMessage.includes('error') || lowerMessage.includes('failed') ||
                lowerMessage.includes('critical') || lowerMessage.includes('fatal') ||
                lowerMessage.includes("no planning") || lowerMessage.includes("insufficient") || lowerMessage.includes("no content")) {
                return "Error";
            } else if (lowerMessage.includes('warning') || lowerMessage.includes('timeout')) {
                return "Warning";
            }
            else if (lowerMessage.includes('success') || lowerMessage.includes('good')
                || lowerMessage.includes('yes')) {
                return "Success";
            }
            return "Information";
        },

        // Determine severity for system alerts
        _determineSystemSeverity: function (success, warnings, errors) {
            if (errors > 0) {
                return "Error";
            } else if (warnings > 0 && errors === 0) {
                return "Warning";
            }
            else if (success > 0) {
                return "Success";
            }
            return "Information";
        },


        // System group icons
        _getSystemGroupIcon: function (group) {
            var iconMap = {
                "PROCESS_JOBS": "sap-icon://activities",
                "INTERFACE": "sap-icon://connected",
                "RESTRICTIONS": "sap-icon://limitation"
            };
            return iconMap[group] || "sap-icon://message-warning";
        },

        // Updated empty cards method for all three cards
        _setEmptyAlertCards: function () {
            var that = this;
            var oSystemCard = that.byId("MyCardId");
            var oDataCard = that.byId("MyCardId1");
            var oExceptionalCard = that.byId("MyCardId3");
            var oInterfaceCard = that.byId("MyCardId4")

            if (oSystemCard) that._showEmptyAlertsCard("System Alerts", "MyCardId");
            if (oDataCard) that._showEmptyAlertsCard("Data Alerts", "MyCardId1");
            if (oExceptionalCard) that._showEmptyAlertsCard("Exception Alerts", "MyCardId3");
            if (oInterfaceCard) that._showEmptyAlertsCard("Interface Alerts", "MyCardId4");
        },

        _showEmptyAlertsCard: function (title, id) {
            var that = this;
            var oEmptyManifest = {
                "sap.app": {
                    "id": "vcp.v4card." + title.toLowerCase().replace(/\s/g, '') + ".empty",
                    "type": "card",
                    "applicationVersion": { "version": "1.0.0" }
                },
                "sap.ui": {
                    "technology": "UI5",
                    "deviceTypes": { "desktop": true, "tablet": true, "phone": true }
                },
                "sap.card": {
                    "type": "List",
                    "data": {
                        "json": {
                            "items": [{

                            }]
                        }
                    },
                    "header": {
                        "title": title,
                        "subTitle": "No active " + title + " found"
                    },
                    "content": {
                        "data": {
                            "path": "/items"
                        },
                        "item": {
                            "title": "{title}",
                            "description": "{description}"
                            // "icon": { "src": "{icon}" }
                        }
                    }
                }
            };

            var oCard = that.byId(id);
            if (oCard) {
                oCard.setManifest(oEmptyManifest);
                console.log("[V4 Alerts] Empty card set for:", title);
            }
        },
        getUser: function () {
            let vUser;
            if (sap.ushell && sap.ushell.Container) {
                let email = sap.ushell.Container.getService("UserInfo")
                    .getUser()
                    .getEmail();
                vUser = email ? email : "";
            }
            return vUser;

        },
        onCardAction: async function (oEvent) {
            const oParams = oEvent.getParameters();
            const oAction = oParams.action || {}; // fallback
            const actionParams = oAction.parameters || oParams.parameters || {}; // safe fallback
            const actionId = actionParams.actionId;

            console.log("Card action triggered:", actionId);

            switch (actionId) {
                case "PROCESS_JOBS":
                    await this._navigateToProcessJobs();
                    break;

                case "INTERFACE":
                    await this._navigateToInterface();
                    break;

                case "RESTRICTIONS":
                    sap.m.MessageToast.show("Restriction alert clicked");
                    break;

                default:
                    sap.m.MessageToast.show("Unknown card action: " + actionId);
            }
        },
        _navigateToProcessJobs: async function () {
            try {
                if (sap.ushell && sap.ushell.Container && sap.ushell.Container.getService) {
                    var oCrossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation");
                    // generate the Hash to display 
                    var hash = (oCrossAppNavigator && oCrossAppNavigator.hrefForExternal({
                        target: {
                            semanticObject: "jobschedulersequence",
                            action: "display"
                        }
                    })) || "";
                    //Generate a  URL for the second application
                    var url = window.location.href.split('#')[0] + hash;
                    //Navigate to second app
                    sap.m.URLHelper.redirect(url, true);
                }
            } catch (err) {
                console.error("Failed to navigate to Process Jobs:", err);
            }
        },

        _navigateToInterface: async function () {
            try {
                if (sap.ushell && sap.ushell.Container && sap.ushell.Container.getService) {
                    var oCrossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation");
                    // generate the Hash to display 
                    var hash = (oCrossAppNavigator && oCrossAppNavigator.hrefForExternal({
                        target: {
                            semanticObject: "jobschedulersequence",
                            action: "display"
                        }
                    })) || "";
                    var oStorage = jQuery.sap.storage(jQuery.sap.storage.Type.local);
                    oStorage.put("nodeId", 58);
                    //Generate a  URL for the second application
                    var url = window.location.href.split('#')[0] + hash;
                    //Navigate to second app
                    sap.m.URLHelper.redirect(url, true);
                }
            } catch (err) {
                console.error("Failed to navigate to Interface:", err);
            }
        },

        _loadCharCards: async function () {
            const oModel = this.getOwnerComponent().getModel();
            const oCard = this.byId("MyCardIdFore");
            if (oCard) oCard.setBusy(true);
            if (!oModel) {
                console.error("OData model not available");
                return;
            }
            var aFilters = [];
            // Get selected keys
            const locSelectedKey = this.byId("LocationSelect").getSelectedKey();
            const prodSelectedKey = this.byId("productSelect").getSelectedKey();
            if (locSelectedKey) {
                aFilters.push(new sap.ui.model.Filter("LOCATION_ID", "EQ", locSelectedKey));
            }

            if (prodSelectedKey) {
                aFilters.push(new sap.ui.model.Filter("PRODUCT_ID", "EQ", prodSelectedKey));
            }

            const aFilters1 = Array.isArray(aFilters) ? aFilters : [];

            const iPageSize = 5000; // tune this depending on your service
            let iSkip = 0;
            let aAllResults = [];
            let bHasMore = true;

            while (bHasMore) {
                // var url = `/getDMDAnalytical?$filter=LOCATION_ID eq '1600'`
                const aContexts = await this.oModel
                    .bindList("/getDMDAnalytical", null, [], aFilters1)
                    .requestContexts(iSkip, iPageSize);

                const aPageResults = aContexts.map(ctx => ctx.getObject());

                aAllResults = aAllResults.concat(aPageResults);

                // If we got less than requested, it's the last page
                if (aPageResults.length < iPageSize) {
                    bHasMore = false;
                } else {
                    iSkip += iPageSize;
                }
            }

            console.log("Total records loaded:", aAllResults.length);

            if (aAllResults.length === 0) {
                sap.m.MessageToast.show("No data available for selected Location & Product");
            } else {
                const oWOWModel = new sap.ui.model.json.JSONModel({
                    options: [
                        { key: "Actual WoW", text: "Actual" },
                        { key: "Forecast WoW", text: "Forecast" }
                    ],
                    selectedKey: "Actual WoW" // ✅ Default selection
                });
                // Set the model at view level
                this.getView().setModel(oWOWModel, "wowModel");
                const oWOWModelVariance = new sap.ui.model.json.JSONModel({
                    Variance: [
                        { key: "10", text: ">10" },
                        { key: "20", text: ">20" },
                        { key: "30", text: ">30" }
                    ],
                    selectedKey: "10" // ✅ Default selection
                });
                // Set the model at view level
                this.getView().setModel(oWOWModelVariance, "wowModelVariance");
                that.wowData = aAllResults;
                var actualWOW = aAllResults.filter(id => id.COMP_TYPE === "Actual WoW" && id.PERCENT_DIFF_WOW > 0.10);
                // const oAssemblyModel = new sap.ui.model.json.JSONModel({ Assembly: that.forecastData });
                this._setActualForecastCard(actualWOW, "Actual");
            }
            oCard.setBusy(false);
        },
        _setActualForecastCard(oData) {
            oData.forEach(d => {
                if (d.THIS_WEEK_DATE?.includes("/Date(")) {
                    const timestamp = parseInt(d.THIS_WEEK_DATE.match(/\d+/)[0]);
                    d.THIS_WEEK_DATE = new Date(timestamp).toISOString().split("T")[0];
                }
            });
            var oVizFrame = this.byId("MyCardIdFore");
            oVizFrame.setBusy(true);
            var oPopOver = new sap.viz.ui5.controls.Popover({});
            oPopOver.connect(oVizFrame.getVizUid());
            oVizFrame.setVizProperties({
                title: { visible: true, text: "WOW Variance" },
                plotArea: {
                    dataLabel: { visible: true },
                    colorPalette: ["#5899DA", "#E8743B", "#19A979", "#ED4A7B", "#945ECF", "#13A4B4"]
                },
                categoryAxis: {
                    title: { visible: true }
                },
                valueAxis: {
                    title: { visible: true }
                },
                legend: { visible: false }
            });
            var oModel = new sap.ui.model.json.JSONModel({ wowVarianceType: oData });
            this.getView().setModel(oModel, "wowVariance");
            oVizFrame.setBusy(false);
            sap.ui.core.BusyIndicator.hide();
        },
        onVarianceChange: function (oEvent) {
            var selectedType = that.byId("idWOW").getSelectedKey();
            var selectedVariance = oEvent.getSource().getSelectedKey();
            var actualWOW = that.wowData.filter(id => id.COMP_TYPE === selectedType && id.PERCENT_DIFF_WOW > selectedVariance);
            this._setActualForecastCard(actualWOW);
        },
        onTypeChange: function (oEvent) {
            var selectedType = oEvent.getSource().getSelectedKey();
            var selectedVariance = that.byId("idVariance").getSelectedKey();
            var actualWOW = that.wowData.filter(id => id.COMP_TYPE === selectedType && id.PERCENT_DIFF_WOW > selectedVariance);
            this._setActualForecastCard(actualWOW);
        },
        onFilterResetWOW: function () {
            that.byId("idVariance").setSelectedKey("Actual WoW");
            that.byId("idWOW").setSelectedKey("0.10");
            var oModel = new sap.ui.model.json.JSONModel({ wowVarianceType: [] });
            this.getView().setModel(oModel, "wowVariance");
        },

        handleCloseButton: function (oEvent) {
            this.byId("myPopover").close();
        },
        onOpenQuickHelp: function (oEvent) {
            var oButton = oEvent.getSource(),
                oView = this.getView();

            if (!this._pPopover) {
                this._pPopover = Fragment.load({
                    id: oView.getId(),
                    name: "vcp.vcplannerdashboard.view.Popover",
                    controller: this
                }).then(function (oPopover) {
                    oView.addDependent(oPopover);
                    // oPopover.bindElement("/ProductCollection/0");
                    return oPopover;
                });
            }
            this._pPopover.then(function (oPopover) {
                oPopover.openBy(oButton);
            });
        },
        handleLinkPress: async function (oEvent) {
            var selectedApp = oEvent.getSource().getText();
            try {
                switch (selectedApp) {
                    case "Option Mix Planning":
                        var semanticObject = "getOptionpercentages",
                            action = "display";
                        break;

                    case "Forecast Orders":
                        var semanticObject = "vcpforecastingorders",
                            action = "display";
                        break;
                    case "Assembly Requirements":
                        var semanticObject = "vcpmaterialrequirements",
                            action = "display";
                        break;
                    case "Restriction Likelihood":
                        var semanticObject = "vcpvendergoodcapacity",
                            action = "display";
                        break;

                    default:
                        break;
                }
                if (sap.ushell && sap.ushell.Container && sap.ushell.Container.getService) {
                    var oCrossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation");
                    // generate the Hash to display 
                    var hash = (oCrossAppNavigator && oCrossAppNavigator.hrefForExternal({
                        target: {
                            semanticObject: semanticObject,
                            action: action
                        }
                    })) || "";
                    //Generate a  URL for the second application
                    var url = window.location.href.split('#')[0] + hash;
                    //Navigate to second app
                    sap.m.URLHelper.redirect(url, true);
                }
            } catch (err) {
                console.error("Failed to navigate to :", err);
            }
        },
        loadAllLags: async function () {
            await that.allFacotryLoc();
            await that.loadAssemblyFac();
        },
        //Load factory location for Assemly lag
        loadAssemblyFac: async function () {
            sap.ui.core.BusyIndicator.show();
            const locSelectedKey = this.byId("LocationSelect").getSelectedKey();
            const prodSelectedKey = this.byId("productSelect").getSelectedKey();
            var aFilters = [];
            // ✅ Add filters only when values exist
            if (locSelectedKey) {
                aFilters.push(new sap.ui.model.Filter("LOCATION_ID", sap.ui.model.FilterOperator.EQ, locSelectedKey));
            }

            if (prodSelectedKey) {
                aFilters.push(new sap.ui.model.Filter("PRODUCT_ID", sap.ui.model.FilterOperator.EQ, prodSelectedKey));
            }

            const iPageSize = 5000; // tune this depending on your service
            let iSkip = 0;
            let aAllResults = [];
            let bHasMore = true;

            while (bHasMore) {
                const aContexts = await this.oModel
                    .bindList("/getAssemblyData", null, null, aFilters)
                    .requestContexts(iSkip, iPageSize);

                const aPageResults = aContexts.map(ctx => ctx.getObject());

                aAllResults = aAllResults.concat(aPageResults);

                // If we got less than requested, it's the last page
                if (aPageResults.length < iPageSize) {
                    bHasMore = false;
                } else {
                    iSkip += iPageSize;
                }
            }

            console.log("Total records loaded:", aAllResults.length);

            if (aAllResults.length === 0) {
                sap.m.MessageToast.show("No data available for selected Location & Product");
            } else {
                that.totalAssemblyData = aAllResults;
                var facLocation = that.removeDuplicates(aAllResults, "FACTORY_LOC");
                var factoryDescription = that.oGModel.getProperty("/fullLocData");
                // Extract matching LOCATION_DESC
                const descMap = factoryDescription.reduce((acc, curr) => {
                    acc[curr.LOCATION_ID] = curr.LOCATION_DESC;
                    return acc;
                }, {});

                // Add LOCATION_DESC to each object in facLocation
                const facLocationWithDesc = facLocation.map(item => ({
                    ...item,
                    LOCATION_DESC: descMap[item.FACTORY_LOC] || "Unknown"
                }));
                const olocModel = new sap.ui.model.json.JSONModel({ Location: facLocationWithDesc });
                this.getView().setModel(olocModel, "location");
                setTimeout(() => {
                    var oLocation = this.byId("cbFactory");
                    var oBinding = oLocation.getBinding("items");
                    if (oBinding) {
                        var aItems = oLocation.getItems();
                        if (aItems.length > 0) {
                            oLocation.setSelectedKey(aItems[0].getKey());
                            oLocation.fireSelectionChange({ selectedItem: aItems[0] });
                        }
                    }
                }, 0);
            }

        },
        //Load assembly lag- start
        allFacotryLoc: function () {
            var totalData = that.oGModel.getProperty("/fullLocProdData");
            const locSelectedKey = this.byId("LocationSelect").getSelectedKey();
            const prodSelectedKey = this.byId("productSelect").getSelectedKey();
            totalData = that.removeDuplicates(totalData.filter(id => id.DEMAND_LOC === locSelectedKey && id.PRODUCT_ID === prodSelectedKey), "FACTORY_LOC");
            const oModel = new sap.ui.model.json.JSONModel({ Factory_loc: totalData });
            this.getView().setModel(oModel, "filters");
            // Define combo boxes and their corresponding fire functions
            const comboConfig = [
                { id: "cbFactoryPL", fn: this.onOptFacChange.bind(this) },
                // { id: "cbFactory", fn: this.onFacLocChange.bind(this) },
                { id: "cbFactoryPR", fn: this.onRtrLocChange.bind(this) },
                { id: "cbFactoryDL", fn: this.onPrdDmdLocChange.bind(this) }
            ];

            // Set first item & trigger selection function for each combo
            comboConfig.forEach(cfg => {
                const oCombo = this.byId(cfg.id);
                if (!oCombo) return;

                setTimeout(() => {
                    const aItems = oCombo.getItems();
                    if (aItems.length > 0) {
                        const oFirstItem = aItems[0];
                        oCombo.setSelectedKey(oFirstItem.getKey());
                        cfg.fn({ getSource: () => oCombo, getParameter: () => ({ selectedItem: oFirstItem }) });
                    }
                }, 200);
            });

        },
        onFacLocChange: async function (oEvent) {
            sap.ui.core.BusyIndicator.show();
            const locSelectedKey = this.byId("LocationSelect").getSelectedKey();
            const prodSelectedKey = this.byId("productSelect").getSelectedKey();
            var facLoc = oEvent.getSource().getSelectedKey();
            var aFilters = [];

            // ✅ Add filters only when values exist
            if (locSelectedKey) {
                aFilters.push(new sap.ui.model.Filter("LOCATION_ID", sap.ui.model.FilterOperator.EQ, locSelectedKey));
            }

            if (prodSelectedKey) {
                aFilters.push(new sap.ui.model.Filter("PRODUCT_ID", sap.ui.model.FilterOperator.EQ, prodSelectedKey));
            }
            if (facLoc) {
                aFilters.push(new sap.ui.model.Filter("FACTORY_LOC", sap.ui.model.FilterOperator.EQ, facLoc));
            }

            const iPageSize = 5000; // tune this depending on your service
            let iSkip = 0;
            let aAllResults = [];
            let bHasMore = true;

            while (bHasMore) {
                const aContexts = await this.oModel
                    .bindList("/getAssemblyData", null, null, aFilters)
                    .requestContexts(iSkip, iPageSize);

                const aPageResults = aContexts.map(ctx => ctx.getObject());

                aAllResults = aAllResults.concat(aPageResults);

                // If we got less than requested, it's the last page
                if (aPageResults.length < iPageSize) {
                    bHasMore = false;
                } else {
                    iSkip += iPageSize;
                }
            }

            console.log("Total records loaded:", aAllResults.length);

            if (aAllResults.length === 0) {
                sap.m.MessageToast.show("No data available for selected Location & Product");
            } else {

                that.totalAssemblyData = aAllResults;
                that.assemblyData = this.removeDuplicates(aAllResults, "ASSEMBLY");
                const oAssemblyModel = new sap.ui.model.json.JSONModel({ Assembly: that.assemblyData });
                this.getView().setModel(oAssemblyModel, "assembly");
                setTimeout(() => {
                    var oAssembly = this.byId("cbAssembly");
                    var oBinding = oAssembly.getBinding("items");

                    if (oBinding) {
                        // oBinding.attachEventOnce("dataReceived", () => {
                        var aItems = oAssembly.getItems();
                        if (aItems.length > 0) {
                            oAssembly.setSelectedKey(aItems[0].getKey());
                            oAssembly.fireSelectionChange({ selectedItem: aItems[0] });
                        }
                        // });
                    }
                }, 0);
            }

            // sap.ui.core.BusyIndicator.hide();
        },
        onAssemblyChange: function (oEvent) {
            var assemblySelected = oEvent.getParameters().selectedItem.getKey();
            var aAllResults = that.totalAssemblyData.filter(id => id.ASSEMBLY === assemblySelected);
            aAllResults = that.removeDuplicates(aAllResults, "MONTH");
            const calendarModel = new sap.ui.model.json.JSONModel({ MONTH: aAllResults });
            that.getView().setModel(calendarModel, "calendar");
            var oCalendar = this.byId("cbMonth");
            setTimeout(() => {
                var aItems = aAllResults;
                if (aItems.length > 0) {
                    oCalendar.setSelectedKey(aItems[0].MONTH);
                    oCalendar.fireSelectionChange({ selectedItem: aItems[0] });
                }
            }, 200);
        },

        onAssemblyGo: function () {
            var loc = this.byId("LocationSelect").getSelectedKey();
            var prod = this.byId("productSelect").getSelectedKey();
            var facloc = this.byId("cbFactory").getSelectedKey();
            var assembly = this.byId("cbAssembly").getSelectedKey();
            var month = this.byId("cbMonth").getSelectedKey();
            var oFunction = this.oModel.bindContext("/getAssemblyLagfun(...)");
            oFunction.setParameter("FACTORY_LOACATION", facloc);
            oFunction.setParameter("LOCATION", loc);
            oFunction.setParameter("PRODUCT", prod);
            oFunction.setParameter("ASSEMBLY_ID", assembly);
            oFunction.setParameter("MONTH", month);

            oFunction.execute().then(function () {
                const oCtx = oFunction.getBoundContext();
                if (!oCtx) {
                    MessageToast.show("No data returned from backend");
                    sap.ui.core.BusyIndicator.hide();
                    return;
                }

                const oResult = oCtx.getObject();
                // CAP V4 function returns { value: "<stringified-json>" }
                let data;

                try {
                    data = JSON.parse(oResult.value.value); // ✅ Parse the string
                    data.sort((a, b) => a.LAG_MONTH - b.LAG_MONTH);
                    that.setAssemblyCardManifest(data);

                } catch (e) {
                    console.error("Invalid JSON returned from backend", e);
                    // MessageToast.show("Error parsing backend data");
                    sap.ui.core.BusyIndicator.hide();
                    return;
                }

            }).catch(function (err) {
                sap.ui.core.BusyIndicator.hide();
                MessageToast.show("Failed to load Assembly Lag data");
            });

        },
        setAssemblyCardManifest: function (oData) {
            var oVizFrame = this.byId("idWFModel");
            oVizFrame.setBusy(true);
            var oPopOver = new sap.viz.ui5.controls.Popover({});
            oPopOver.connect(oVizFrame.getVizUid());
            oVizFrame.setVizProperties({
                title: { visible: true, text: "Assembly Lag Analysis" },
                plotArea: {
                    dataLabel: { visible: true },
                    colorPalette: ["#5899DA", "#E8743B", "#19A979", "#ED4A7B", "#945ECF", "#13A4B4"]
                },
                categoryAxis: {
                    title: { visible: true }
                },
                valueAxis: {
                    title: { visible: true }
                },
                legend: { visible: false }
            });
            var oModel = new sap.ui.model.json.JSONModel({ WaterfallData: oData });
            this.getView().setModel(oModel, "waterfallModel");
            oVizFrame.setBusy(false);
            sap.ui.core.BusyIndicator.hide();
        },
        onFilterResetAssembly: function () {
            that.byId("cbFactory").setSelectedKey();
            that.byId("cbAssembly").setSelectedKey();
            that.byId("cbMonth").setSelectedKey();
            var oModel = new sap.ui.model.json.JSONModel({ WaterfallData: [] });
            this.getView().setModel(oModel, "waterfallModel");
            // that._showEmptyAlertsCard("Assembly Lag Analysis", "idWFModel")
        },
        onFilterResetOptMix: function () {
            that.byId("cbFactoryPL").setSelectedKey();
            that.byId("cbMonthPL").setSelectedKey();
            that.byId("cbCharPL").setSelectedKey();
            that.byId("cbCharValPL").setSelectedKey();
            var oModel = new sap.ui.model.json.JSONModel({ WaterfallDataOpt: [] });
            this.getView().setModel(oModel, "waterfallModelOpt");
        },
        onFilterResetRtr: function () {
            that.byId("cbFactoryPR").setSelectedKey();
            that.byId("cbMonthPR").setSelectedKey();
            that.byId("cbLinePR").setSelectedKey();
            that.byId("cbRstrPR").setSelectedKey();
            var oModel = new sap.ui.model.json.JSONModel({ WaterfallDataRTR: [] });
            this.getView().setModel(oModel, "rtrLagModel");
        },
        onFilterResetPrdDmd: function () {
            that.byId("cbFactoryDL").setSelectedKey();
            that.byId("cbMonthDL").setSelectedKey();
            var oModel = new sap.ui.model.json.JSONModel({ WaterfallDataPrdDmd: [] });
            this.getView().setModel(oModel, "prddmdLagModel");
        },
        //Load assembly lag- end
        //Load option mix lag- start
        loadOptMixLag: function () {
            var totalData = that.oGModel.getProperty("/fullLocProdData");
            const locSelectedKey = this.byId("LocationSelect").getSelectedKey();
            const prodSelectedKey = this.byId("productSelect").getSelectedKey();
            totalData = that.removeDuplicates(totalData.filter(id => id.DEMAND_LOC === locSelectedKey && id.PRODUCT_ID === prodSelectedKey), "FACTORY_LOC");
            const oModel = new sap.ui.model.json.JSONModel({ Factory_loc: totalData });
            this.getView().setModel(oModel, "filters");
            var oFactoryCombo = this.byId("cbFactoryPL");
            setTimeout(() => {
                var aItems = oFactoryCombo.getItems();
                if (aItems.length > 0) {
                    oFactoryCombo.setSelectedKey(aItems[0].getKey());
                    oFactoryCombo.fireSelectionChange({ selectedItem: aItems[0] });
                }
            }, 200);

        },
        onOptFacChange: async function (oEvent) {
            sap.ui.core.BusyIndicator.show();
            const locSelectedKey = this.byId("LocationSelect").getSelectedKey();
            const prodSelectedKey = this.byId("productSelect").getSelectedKey();
            var facLoc = oEvent.getSource().getSelectedKey();
            var aFilters = [];

            // ✅ Add filters only when values exist
            if (locSelectedKey) {
                aFilters.push(new sap.ui.model.Filter("LOCATION_ID", sap.ui.model.FilterOperator.EQ, locSelectedKey));
            }

            if (prodSelectedKey) {
                aFilters.push(new sap.ui.model.Filter("PRODUCT_ID", sap.ui.model.FilterOperator.EQ, prodSelectedKey));
            }
            if (facLoc) {
                aFilters.push(new sap.ui.model.Filter("FACTORY_LOC", sap.ui.model.FilterOperator.EQ, facLoc));
            }

            const iPageSize = 5000; // tune this depending on your service
            let iSkip = 0;
            let aAllResults = [];
            let bHasMore = true;

            while (bHasMore) {
                const aContexts = await this.oModel
                    .bindList("/getOptPrtData", null, null, aFilters)
                    .requestContexts(iSkip, iPageSize);

                const aPageResults = aContexts.map(ctx => ctx.getObject());

                aAllResults = aAllResults.concat(aPageResults);

                // If we got less than requested, it's the last page
                if (aPageResults.length < iPageSize) {
                    bHasMore = false;
                } else {
                    iSkip += iPageSize;
                }
            }

            console.log("Total records loaded:", aAllResults.length);

            if (aAllResults.length === 0) {
                sap.m.MessageToast.show("No data available for selected Location & Product");
            } else {

                that.totalOptMixData = aAllResults;
                that.monthData = this.removeDuplicates(aAllResults, "MONTH");
                const oMonthModel = new sap.ui.model.json.JSONModel({ Month: that.monthData });
                this.getView().setModel(oMonthModel, "calendarOpt");
                setTimeout(() => {
                    var oMonth = this.byId("cbMonthPL");
                    var oBinding = oMonth.getBinding("items");

                    if (oBinding) {
                        // oBinding.attachEventOnce("dataReceived", () => {
                        var aItems = oMonth.getItems();
                        if (aItems.length > 0) {
                            oMonth.setSelectedKey(aItems[0].getKey());
                            oMonth.fireSelectionChange({ selectedItem: aItems[0] });
                        }
                        // });
                    }
                }, 0);
            }

            // sap.ui.core.BusyIndicator.hide();
        },
        onOptMonthChange: function (oEvent) {
            var monthSelected = oEvent.getParameters().selectedItem.getKey();
            var aAllResults = that.totalOptMixData.filter(id => id.MONTH === monthSelected);
            aAllResults = that.removeDuplicates(aAllResults, "CHAR_NUM");
            const charModel = new sap.ui.model.json.JSONModel({ CHARA_NUM: aAllResults });
            that.getView().setModel(charModel, "characteristic");

            setTimeout(() => {
                var oChar = this.byId("cbCharPL");
                var oCharBinding = oChar.getBinding("items");
                if (oCharBinding) {
                    var aItems = oChar.getItems();
                    if (aItems.length > 0) {
                        oChar.setSelectedKey(aItems[0].getKey());
                        oChar.fireSelectionChange({ selectedItem: aItems[0] });
                    }
                }
            }, 200);
        },
        onOptCharChange: function (oEvent) {
            var charSelected = oEvent.getParameters().selectedItem.getKey();
            var monthSelected = that.byId("cbMonthPL").getSelectedKey();
            var aAllResults = that.totalOptMixData.filter(id => id.CHAR_NUM === charSelected && id.MONTH === monthSelected);
            aAllResults = that.removeDuplicates(aAllResults, "CHAR_VALUE");
            const charValModel = new sap.ui.model.json.JSONModel({ CHARA_VALUE: aAllResults });
            that.getView().setModel(charValModel, "characteristicValue");

            setTimeout(() => {
                var oCharVal = this.byId("cbCharValPL");
                var oCharValBinding = oCharVal.getBinding("items");
                if (oCharValBinding) {
                    var aItems = oCharVal.getItems();
                    if (aItems.length > 0) {
                        oCharVal.setSelectedKey(aItems[0].getKey());
                        oCharVal.fireSelectionChange({ selectedItem: aItems[0] });
                    }
                }
            }, 200);
        },
        onOptMixGo: function () {
            var loc = this.byId("LocationSelect").getSelectedKey();
            var prod = this.byId("productSelect").getSelectedKey();
            var facloc = this.byId("cbFactoryPL").getSelectedKey();
            var characteristic = this.byId("cbCharPL").getSelectedKey();
            var monthOpt = this.byId("cbMonthPL").getSelectedKey();
            var charvalOpt = this.byId("cbCharValPL").getSelectedKey();
            var oFunction = this.oModel.bindContext("/getOptPercentLagFun(...)");
            oFunction.setParameter("FACTORY_LOACATION", facloc);
            oFunction.setParameter("LOCATION", loc);
            oFunction.setParameter("PRODUCT", prod);
            oFunction.setParameter("MONTH", monthOpt);
            oFunction.setParameter("CHARACTERISTIC", characteristic);
            oFunction.setParameter("CHARACTERISTIC_VALUE", charvalOpt);

            oFunction.execute().then(function () {
                const oCtx = oFunction.getBoundContext();
                if (!oCtx) {
                    MessageToast.show("No data returned from backend");
                    sap.ui.core.BusyIndicator.hide();
                    return;
                }

                const oResult = oCtx.getObject();
                // CAP V4 function returns { value: "<stringified-json>" }
                let data;

                try {
                    data = JSON.parse(oResult.value.value); // ✅ Parse the string
                    data.sort((a, b) => a.LAG_MONTH - b.LAG_MONTH);
                    that.setOptionCardManifest(data);

                } catch (e) {
                    console.error("Invalid JSON returned from backend", e);
                    // MessageToast.show("Error parsing backend data");
                    sap.ui.core.BusyIndicator.hide();
                    return;
                }

            }).catch(function (err) {
                sap.ui.core.BusyIndicator.hide();
                MessageToast.show("Failed to load Opt Mix Lag data");
            });

        },
        setOptionCardManifest: function (oData) {
            var oVizFrame = this.byId("idOptMixWF");
            oVizFrame.setBusy(true);
            var oPopOver = new sap.viz.ui5.controls.Popover({});
            oPopOver.connect(oVizFrame.getVizUid());
            oVizFrame.setVizProperties({
                title: { visible: true, text: "Option Mix Lag Analysis" },
                plotArea: {
                    dataLabel: { visible: true },
                    colorPalette: ["#5899DA", "#E8743B", "#19A979", "#ED4A7B", "#945ECF", "#13A4B4"]
                },
                categoryAxis: {
                    title: { visible: true }
                },
                valueAxis: {
                    title: { visible: true }
                },
                legend: { visible: false }
            });
            var oModel = new sap.ui.model.json.JSONModel({ WaterfallDataOpt: oData });
            this.getView().setModel(oModel, "waterfallModelOpt");
            oVizFrame.setBusy(false);
            sap.ui.core.BusyIndicator.hide();
        },
        //Load RTR Filters- Start
        onRtrLocChange: async function (oEvent) {
            sap.ui.core.BusyIndicator.show();
            const locSelectedKey = this.byId("LocationSelect").getSelectedKey();
            const prodSelectedKey = this.byId("productSelect").getSelectedKey();
            var facLoc = oEvent.getSource().getSelectedKey();
            var aFilters = [];

            // ✅ Add filters only when values exist
            if (locSelectedKey) {
                aFilters.push(new sap.ui.model.Filter("LOCATION_ID", sap.ui.model.FilterOperator.EQ, locSelectedKey));
            }
            if (facLoc) {
                aFilters.push(new sap.ui.model.Filter("FACTORY_LOC", sap.ui.model.FilterOperator.EQ, facLoc));
            }

            const iPageSize = 5000; // tune this depending on your service
            let iSkip = 0;
            let aAllResults = [];
            let bHasMore = true;

            while (bHasMore) {
                const aContexts = await this.oModel
                    .bindList("/getRTRData", null, null, aFilters)
                    .requestContexts(iSkip, iPageSize);

                const aPageResults = aContexts.map(ctx => ctx.getObject());

                aAllResults = aAllResults.concat(aPageResults);

                // If we got less than requested, it's the last page
                if (aPageResults.length < iPageSize) {
                    bHasMore = false;
                } else {
                    iSkip += iPageSize;
                }
            }

            console.log("Total records loaded:", aAllResults.length);

            if (aAllResults.length === 0) {
                sap.m.MessageToast.show("No data available for selected Location & Product");
            } else {
                that.rtrLineData = aAllResults;
                var monthDataRtr = this.removeDuplicates(aAllResults, "MONTH");
                const oMonthModelRtr = new sap.ui.model.json.JSONModel({ MonthRtr: monthDataRtr });
                this.getView().setModel(oMonthModelRtr, "calendarRtr");
                setTimeout(() => {
                    var oMonth = this.byId("cbMonthPR");
                    var oBinding = oMonth.getBinding("items");

                    if (oBinding) {
                        var aItems = oMonth.getItems();
                        if (aItems.length > 0) {
                            oMonth.setSelectedKey(aItems[0].getKey());
                            oMonth.fireSelectionChange({ selectedItem: aItems[0] });
                        }
                    }
                }, 0);
            }
        },
        onRtrMonthChange: function (oEvent) {
            var monthSelected = oEvent.getParameters().selectedItem.getKey();
            var aAllResults = that.rtrLineData.filter(id => id.MONTH === monthSelected);
            aAllResults = that.removeDuplicates(aAllResults, "LINE_ID");
            const rtrLineModel = new sap.ui.model.json.JSONModel({ LINEIDRTR: aAllResults });
            that.getView().setModel(rtrLineModel, "LINEIDRT");
            setTimeout(() => {
                var oChar = this.byId("cbLinePR");
                var oCharBinding = oChar.getBinding("items");
                if (oCharBinding) {
                    var aItems = oChar.getItems();
                    if (aItems.length > 0) {
                        oChar.setSelectedKey(aItems[0].getKey());
                        oChar.fireSelectionChange({ selectedItem: aItems[0] });
                    }
                }
            }, 0);

        },
        onRtrLineChange: function (oEvent) {
            var lineSelected = oEvent.getParameters().selectedItem.getKey();
            var monthSelected = that.byId("cbMonthPR").getSelectedKey();
            var aAllResults = that.rtrLineData.filter(id => id.MONTH === monthSelected && id.LINE_ID === lineSelected);
            aAllResults = that.removeDuplicates(aAllResults, "RESTRICTION");
            const rtrModel = new sap.ui.model.json.JSONModel({ RTR_ID: aAllResults });
            that.getView().setModel(rtrModel, "RTRID");
            setTimeout(() => {
                var oChar = this.byId("cbRstrPR");
                var oCharBinding = oChar.getBinding("items");
                if (oCharBinding) {
                    var aItems = oChar.getItems();
                    if (aItems.length > 0) {
                        oChar.setSelectedKey(aItems[0].getKey());
                        oChar.fireSelectionChange({ selectedItem: aItems[0] });
                    }
                }
            }, 0);
        },
        onRtrGo: function () {
            var loc = this.byId("LocationSelect").getSelectedKey();
            var facloc = this.byId("cbFactoryPR").getSelectedKey();
            var monthRtr = this.byId("cbMonthPR").getSelectedKey();
            var lineRtr = this.byId("cbLinePR").getSelectedKey();
            var rtrId = this.byId("cbRstrPR").getSelectedKey();
            var oFunction = this.oModel.bindContext("/getRestrictionLagFun(...)");
            oFunction.setParameter("FACTORY_LOACATION", facloc);
            oFunction.setParameter("LOCATION", loc);
            oFunction.setParameter("LINE", lineRtr);
            oFunction.setParameter("RESTRICTION_ID", rtrId);
            oFunction.setParameter("MONTH", monthRtr);

            oFunction.execute().then(function () {
                const oCtx = oFunction.getBoundContext();
                if (!oCtx) {
                    MessageToast.show("No data returned from backend");
                    sap.ui.core.BusyIndicator.hide();
                    return;
                }

                const oResult = oCtx.getObject();
                // CAP V4 function returns { value: "<stringified-json>" }
                let data;

                try {
                    data = JSON.parse(oResult.value.value); // ✅ Parse the string
                    data.sort((a, b) => a.LAG_MONTH - b.LAG_MONTH);
                    that.setOptionCardManifestRtr(data);

                } catch (e) {
                    console.error("Invalid JSON returned from backend", e);
                    // MessageToast.show("Error parsing backend data");
                    sap.ui.core.BusyIndicator.hide();
                    return;
                }

            }).catch(function (err) {
                sap.ui.core.BusyIndicator.hide();
                MessageToast.show("Failed to load RTR Lag data");
            });

        },
        setOptionCardManifestRtr: function (oData) {
            var oVizFrame = this.byId("idRTRWF");
            oVizFrame.setBusy(true);
            var oPopOver = new sap.viz.ui5.controls.Popover({});
            oPopOver.connect(oVizFrame.getVizUid());
            oVizFrame.setVizProperties({
                title: { visible: true, text: "Restriction Lag Analysis" },
                plotArea: {
                    dataLabel: { visible: true },
                    colorPalette: ["#5899DA", "#E8743B", "#19A979", "#ED4A7B", "#945ECF", "#13A4B4"]
                },
                categoryAxis: {
                    title: { visible: true }
                },
                valueAxis: {
                    title: { visible: true }
                },
                legend: { visible: false }
            });
            var oModel = new sap.ui.model.json.JSONModel({ WaterfallDataRTR: oData });
            this.getView().setModel(oModel, "rtrLagModel");
            oVizFrame.setBusy(false);
            sap.ui.core.BusyIndicator.hide();
        },
        onPrdDmdLocChange: async function (oEvent) {
            sap.ui.core.BusyIndicator.show();
            const locSelectedKey = this.byId("LocationSelect").getSelectedKey();
            const prodSelectedKey = this.byId("productSelect").getSelectedKey();
            var facLoc = oEvent.getSource().getSelectedKey();
            var aFilters = [];

            // ✅ Add filters only when values exist
            if (locSelectedKey) {
                aFilters.push(new sap.ui.model.Filter("LOCATION_ID", sap.ui.model.FilterOperator.EQ, locSelectedKey));
            }

            if (prodSelectedKey) {
                aFilters.push(new sap.ui.model.Filter("PRODUCT_ID", sap.ui.model.FilterOperator.EQ, prodSelectedKey));
            }
            if (facLoc) {
                aFilters.push(new sap.ui.model.Filter("FACTORY_LOC", sap.ui.model.FilterOperator.EQ, facLoc));
            }

            const iPageSize = 5000; // tune this depending on your service
            let iSkip = 0;
            let aAllResults = [];
            let bHasMore = true;

            while (bHasMore) {
                const aContexts = await this.oModel
                    .bindList("/getPrdDmdData", null, null, aFilters)
                    .requestContexts(iSkip, iPageSize);

                const aPageResults = aContexts.map(ctx => ctx.getObject());

                aAllResults = aAllResults.concat(aPageResults);

                // If we got less than requested, it's the last page
                if (aPageResults.length < iPageSize) {
                    bHasMore = false;
                } else {
                    iSkip += iPageSize;
                }
            }

            console.log("Total records loaded:", aAllResults.length);

            if (aAllResults.length === 0) {
                sap.m.MessageToast.show("No data available for selected Location & Product");
            } else {
                that.prdDmdData = aAllResults;
                var monthDataPrdDMD = this.removeDuplicates(aAllResults, "MONTH");
                const oMonthModelPrdDmd = new sap.ui.model.json.JSONModel({ MonthPrd: monthDataPrdDMD });
                this.getView().setModel(oMonthModelPrdDmd, "calendarPrdDmd");
                setTimeout(() => {
                    var oMonth = this.byId("cbMonthDL");
                    var oBinding = oMonth.getBinding("items");

                    if (oBinding) {
                        var aItems = oMonth.getItems();
                        if (aItems.length > 0) {
                            oMonth.setSelectedKey(aItems[0].getKey());
                            oMonth.fireSelectionChange({ selectedItem: aItems[0] });
                        }
                    }
                }, 0);
            }
        },
        onPrdDmdGo: function () {
            var loc = this.byId("LocationSelect").getSelectedKey();
            var prod = this.byId("productSelect").getSelectedKey();
            var facloc = this.byId("cbFactoryDL").getSelectedKey();
            var monthPrdDmd = this.byId("cbMonthDL").getSelectedKey();
            var oFunction = this.oModel.bindContext("/getPrdDmdLagFun(...)");
            oFunction.setParameter("FACTORY_LOACATION", facloc);
            oFunction.setParameter("LOCATION", loc);
            oFunction.setParameter("MONTH", monthPrdDmd);
            oFunction.setParameter("PRODUCT", prod);
            oFunction.execute().then(function () {
                const oCtx = oFunction.getBoundContext();
                if (!oCtx) {
                    MessageToast.show("No data returned from backend");
                    sap.ui.core.BusyIndicator.hide();
                    return;
                }

                const oResult = oCtx.getObject();
                // CAP V4 function returns { value: "<stringified-json>" }
                let data;

                try {
                    data = JSON.parse(oResult.value.value); // ✅ Parse the string
                    data.sort((a, b) => a.LAG_MONTH - b.LAG_MONTH);
                    that.setOptionCardManifestPRDDMD(data);

                } catch (e) {
                    console.error("Invalid JSON returned from backend", e);
                    // MessageToast.show("Error parsing backend data");
                    sap.ui.core.BusyIndicator.hide();
                    return;
                }

            }).catch(function (err) {
                sap.ui.core.BusyIndicator.hide();
                MessageToast.show("Failed to load RTR Lag data");
            });

        },
        setOptionCardManifestPRDDMD: function (oData) {
            var oVizFrame = this.byId("idPRDDMDWF");
            oVizFrame.setBusy(true);
            var oPopOver = new sap.viz.ui5.controls.Popover({});
            oPopOver.connect(oVizFrame.getVizUid());
            oVizFrame.setVizProperties({
                title: { visible: true, text: "Product Demand Lag Analysis" },
                plotArea: {
                    dataLabel: { visible: true },
                    colorPalette: ["#5899DA", "#E8743B", "#19A979", "#ED4A7B", "#945ECF", "#13A4B4"]
                },
                categoryAxis: {
                    title: { visible: true }
                },
                valueAxis: {
                    title: { visible: true }
                },
                legend: { visible: false }
            });
            var oModel = new sap.ui.model.json.JSONModel({ WaterfallDataPrdDmd: oData });
            this.getView().setModel(oModel, "prddmdLagModel");
            oVizFrame.setBusy(false);
            sap.ui.core.BusyIndicator.hide();
        },
        // 
        onAdaptWidgets: function (oEvent) {
            var oView = this.getView();
            var oButton = oEvent.getSource();
            var that = this;

            if (this._oWidgetPopover) {
                try {
                    if (this._oWidgetPopover.isOpen && this._oWidgetPopover.isOpen()) {
                        this._oWidgetPopover.close();
                    } else {
                        this._oWidgetPopover.openBy(oButton);
                    }
                } catch (e) {
                    console.error("Error toggling popover:", e);
                }
                return;
            }

            // Load fragment only once
            Fragment.load({
                id: oView.getId(),
                name: "vcp.vcplannerdashboard.view.AdaptWidgets",
                controller: this
            }).then(function (oPopover) {

                oView.addDependent(oPopover);
                that._oWidgetPopover = oPopover;
                // ✅ Create random widget data before opening
                const aWidgets = [];
                const widgetNames = [
                    "Alerts", "Lags", "Forecast"
                ];

                for (let i = 0; i < 3; i++) {
                    aWidgets.push({
                        ID: i + 1,
                        Name: widgetNames[i]
                    });
                }

                // ✅ Create JSON model and set to popover
                const oWidgetModel = new sap.ui.model.json.JSONModel({
                    widgetCollection: aWidgets
                });
                oPopover.setModel(oWidgetModel);

                if (typeof oPopover.openBy === "function") {
                    oPopover.attachAfterOpen(function () {
                        const oTable = Fragment.byId(oView.getId(), "idWidgetTable");

                        if (that._aSelectedWidgets && that._aSelectedWidgets.length > 0) {
                            // reselect previously saved ones
                            oTable.getItems().forEach(item => {
                                const oData = item.getBindingContext().getObject();
                                if (that._aSelectedWidgets.some(w => w.ID === oData.ID)) {
                                    oTable.setSelectedItem(item, true);
                                }
                            });
                        } else {
                            // first time: select all
                            if (oTable && oTable.selectAll) {
                                oTable.selectAll();
                            }
                        }
                    });
                    oPopover.openBy(oButton);
                    console.log("AdaptWidgets popover opened");
                } else {
                    console.error("Loaded fragment does not support openBy()");

                }
            }).catch(function (oError) {
                console.error("Failed to load fragment");

            });
        },
        onWidgetSearch: function (oEvent) {
            const sQuery = oEvent.getParameter("newValue");
            const oTable = Fragment.byId(this.getView().getId(), "idWidgetTable");
            const oBinding = oTable.getBinding("items");

            if (sQuery) {
                const oFilter = new sap.ui.model.Filter("Name", sap.ui.model.FilterOperator.Contains, sQuery);
                oBinding.filter([oFilter]);
            } else {
                oBinding.filter([]);
            }
        },

        onSelectWidget: function () {
            const oTable = Fragment.byId(this.getView().getId(), "idWidgetTable");
            const aSelectedItems = oTable.getSelectedItems();

            // Extract selected widget objects
            const aSelectedWidgets = aSelectedItems.map(function (item) {
                return item.getBindingContext().getObject();
            });

            // ✅ Save confirmed selection for persistence
            this._aSelectedWidgets = aSelectedWidgets;

            // Extract names
            const aNames = aSelectedWidgets.map(w => w.Name);

            // --- Visibility logic ---
            const oAlerts = this.byId("alertsPanel");
            const oLags = this.byId("lagsPanel");
            const oForecast = this.byId("idRow4");

            oAlerts.setVisible(aNames.includes("Alerts"));
            oLags.setVisible(aNames.includes("Lags"));
            oForecast.setVisible(aNames.includes("Forecast"));


            // Close popover
            if (this._oWidgetPopover) {
                this._oWidgetPopover.close();
            }
        },
        onCloseWidget: function (oEvent) {
            const oTable = Fragment.byId(this.getView().getId(), "idWidgetTable");

            // ✅ Restore last confirmed selections
            oTable.removeSelections();

            if (this._aSelectedWidgets && this._aSelectedWidgets.length > 0) {
                oTable.getItems().forEach(item => {
                    const oData = item.getBindingContext().getObject();
                    if (this._aSelectedWidgets.some(w => w.ID === oData.ID)) {
                        oTable.setSelectedItem(item, true);
                    }
                });
            }

            // Close popover
            if (this._oWidgetPopover) {
                this._oWidgetPopover.close();
            }
        },
        //Variant Code Starts//
        getVariantData: async function () {
            sap.ui.core.BusyIndicator.show();
            try {
                const variantUser = (this.getUser() || "").toLowerCase();
                const appName = this.getOwnerComponent().getManifestEntry("/sap.app/id");
                this.oGModel.setProperty("/UserId", variantUser);

                // --- Build filters ---
                const oFilterUserScope = new sap.ui.model.Filter({
                    filters: [
                        new sap.ui.model.Filter("APPLICATION_NAME", sap.ui.model.FilterOperator.EQ, appName),
                        new sap.ui.model.Filter("USER", sap.ui.model.FilterOperator.EQ, variantUser)
                    ],
                    and: true
                });

                const oFilterPublicScope = new sap.ui.model.Filter({
                    filters: [
                        new sap.ui.model.Filter("APPLICATION_NAME", sap.ui.model.FilterOperator.EQ, appName),
                        new sap.ui.model.Filter("SCOPE", sap.ui.model.FilterOperator.EQ, "Public")
                    ],
                    and: true
                });

                const oFinalFilter = new sap.ui.model.Filter({
                    filters: [oFilterUserScope, oFilterPublicScope],
                    and: false
                });

                // --- Fetch header variants ---
                const aContexts = await this.oModel.bindList("/getVariantHeader", null, [], oFinalFilter).requestContexts();
                const aResults = aContexts.map(ctx => ctx.getObject());
                this.oGModel.setProperty("/headerDetails", aResults);

                // --- VariantManagement control reference ---
                const oVariantMgmt = this.byId("idMatListVPD");

                // --- Handle case: No variants exist ---
                if (aResults.length === 0) {
                    const defaultVariant = [{
                        VARIANTNAME: "Standard",
                        VARIANTID: "0",
                        DEFAULT: "Y",
                        REMOVE: false,
                        CHANGE: false,
                        USER: "SAP",
                        SCOPE: sap.m.SharingMode.Public
                    }];

                    this.oGModel.setProperty("/variantDetails", []);
                    this.oGModel.setProperty("/fromFunction", "X");
                    this.oGModel.setProperty("/viewNames", defaultVariant);
                    this.oGModel.setProperty("/defaultDetails", "");

                    // Update model on VariantManagement
                    const oViewModel = new sap.ui.model.json.JSONModel({ items12: defaultVariant });
                    oVariantMgmt.setModel(oViewModel);
                    oVariantMgmt.setDefaultKey("0");
                    oVariantMgmt.setSelectedKey("0");

                    // Load Standard variant
                    const newVariant = this.oGModel.getProperty("/newVariant");
                    if (this.oGModel.getProperty("/newVaraintFlag") === "X" && newVariant) {
                        this.handleSelectPress(newVariant[0].VARIANTNAME);
                        this.oGModel.setProperty("/newVaraintFlag", "");
                    } else {
                        this.handleSelectPress("Standard");
                    }

                    sap.ui.core.BusyIndicator.hide();
                    return;
                }

                // --- Handle case: Variants exist ---
                const aUserVariants = [];
                let sDefaultVariantId = null;

                const aProcessed = aResults.map(item => {
                    if (item.DEFAULT === "Y" && item.USER === variantUser) {
                        sDefaultVariantId = item.VARIANTID;
                        aUserVariants.push(item);
                    }
                    if (item.USER !== variantUser) {
                        item.CHANGE = false;
                        item.REMOVE = false;
                        item.ENABLE = false;
                    }
                    return item;
                });

                if (aUserVariants.length) {
                    this.oGModel.setProperty("/defaultVariant", aUserVariants);
                }

                this.oGModel.setProperty("/VariantData", aProcessed);

                // --- Configure VariantManagement UI ---
                const oViewModel = new sap.ui.model.json.JSONModel({ items12: aProcessed });
                oVariantMgmt.setModel(oViewModel);

                if (sDefaultVariantId) {
                    oVariantMgmt.setDefaultKey(sDefaultVariantId);
                    oVariantMgmt.setSelectedKey(sDefaultVariantId);
                }

                // --- Load variant details ---
                await this.getTotalVariantDetails();

            } catch (err) {
                console.error("Error in getVariantData:", err);
                sap.m.MessageToast.show("Error while loading variant details");
            } finally {
                sap.ui.core.BusyIndicator.hide();
            }
        },

        getTotalVariantDetails: async function () {
            sap.ui.core.BusyIndicator.show();

            try {
                const oVariantMgmt = this.byId("idMatListVPD");
                const headerData = this.oGModel.getProperty("/VariantData") || [];
                const userVariant = this.oGModel.getProperty("/UserId");

                if (!headerData.length) {
                    sap.m.MessageToast.show("No variant headers found.");
                    sap.ui.core.BusyIndicator.hide();
                    return;
                }

                // --- Build filters dynamically ---
                const oFilters = headerData.map(h =>
                    new sap.ui.model.Filter("VARIANTID", sap.ui.model.FilterOperator.EQ, h.VARIANTID)
                );

                // --- Fetch variant details from backend ---
                const aContexts = await this.oModel.bindList("/getVariant", null, [], oFilters).requestContexts();
                const variantDetailData = aContexts.map(ctx => ctx.getObject());
                this.oGModel.setProperty("/fieldDetails", variantDetailData);

                // --- Merge header + detail data ---
                let mergedData = variantDetailData.map(detail => {
                    const header = headerData.find(h => h.VARIANTID === detail.VARIANTID);
                    return header ? { ...detail, ...header } : { ...detail };
                });

                // Normalize scope display
                mergedData = mergedData.map(item => ({
                    ...item,
                    SCOPE: item.SCOPE === "Public" ? sap.m.SharingMode.Public : sap.m.SharingMode.Private
                }));

                this.oGModel.setProperty("/variantDetails", mergedData);

                // --- Prepare unique variants ---
                let uniqueVariants = this.removeDuplicate(mergedData, "VARIANTNAME");
                const defaultDetails = [];
                let defaultVariantName = null;

                uniqueVariants.forEach(v => {
                    if (v.DEFAULT === "Y" && v.USER === userVariant) {
                        defaultVariantName = v.VARIANTNAME;
                        defaultDetails.push({
                            VARIANTNAME: v.VARIANTNAME,
                            VARIANTID: v.VARIANTID,
                            USER: v.USER,
                            DEFAULT: v.DEFAULT
                        });
                    }
                });

                this.oGModel.setProperty("/defaultDetails", defaultDetails);
                this.oGModel.setProperty("/fromFunction", "X");

                // --- Always prepend Standard view ---
                const standardVariant = {
                    VARIANTNAME: "Standard",
                    VARIANTID: "0",
                    DEFAULT: defaultVariantName ? "N" : "Y",
                    REMOVE: false,
                    CHANGE: false,
                    USER: "SAP",
                    SCOPE: sap.m.SharingMode.Public
                };

                uniqueVariants.unshift(standardVariant);
                this.oGModel.setProperty("/viewNames", uniqueVariants);

                // --- Assign variant model to control ---
                const variantModel = new sap.ui.model.json.JSONModel({ items12: uniqueVariants });
                oVariantMgmt.setModel(variantModel);

                // --- Determine active key ---
                const newVariantFlag = this.oGModel.getProperty("/newVaraintFlag");
                const newVariant = this.oGModel.getProperty("/newVariant");
                let selectedKey = "0"; // default: Standard

                if (newVariantFlag === "X" && newVariant?.length) {
                    selectedKey = newVariant[0].VARIANTID;
                    this.oGModel.setProperty("/newVaraintFlag", "");
                    this.handleSelectPress(newVariant[0].VARIANTNAME);
                } else if (defaultVariantName) {
                    const defItem = uniqueVariants.find(v => v.VARIANTNAME === defaultVariantName);
                    if (defItem) {
                        selectedKey = defItem.VARIANTID;
                        this.handleSelectPress(defaultVariantName);
                    }
                } else {
                    this.handleSelectPress("Standard");
                }

                // --- Update variant management selection ---
                this.UniqueDefKey = selectedKey;
                oVariantMgmt.setDefaultKey(selectedKey);
                oVariantMgmt.setSelectedKey(selectedKey);

                sap.m.MessageToast.show("Variants loaded successfully");

            } catch (err) {
                console.error("Error in getTotalVariantDetails:", err);
                sap.m.MessageToast.show("Error while loading variant details");
            } finally {
                sap.ui.core.BusyIndicator.hide();
            }
        },
        removeDuplicate: function (array, key) {
            var check = new Set();
            return array.filter(
                (obj) => !check.has(obj[key]) && check.add(obj[key])
            );
        },

        onCreate: async function (oEvent) {
            sap.ui.core.BusyIndicator.show();
            try {
                const sLocation = this.byId("LocationSelect").getSelectedKey();
                const sProduct = this.byId("productSelect").getSelectedKey();

                if (!sLocation && !sProduct) {
                    return sap.m.MessageToast.show("No values selected in filters Location & Product");
                }

                const appName = this.getOwnerComponent().getManifestEntry("/sap.app/id");
                const varName = oEvent.getParameters().name;
                const sDefault = oEvent.getParameters().def ? "Y" : "N";
                const sScope = oEvent.getParameters().public ? "Public" : "Private";

                const dataArray = [
                    sLocation && { Field: "Location", Value: sLocation, Default: sDefault },
                    sProduct && { Field: "Product", Value: sProduct }
                ].filter(Boolean);
                const bAlerts = this.byId("alertsPanel").getVisible();
                const bLags = this.byId("lagsPanel").getVisible();
                const bForecast = this.byId("idRow4").getVisible();

                dataArray.push({ Field: "ALERTS_VISIBLE", Value: String(bAlerts) });
                dataArray.push({ Field: "LAGS_VISIBLE", Value: String(bLags) });
                dataArray.push({ Field: "FORECAST_VISIBLE", Value: String(bForecast) });

                dataArray.forEach(d => {
                    d.IDNAME = varName;
                    d.App_Name = appName;
                    d.SCOPE = sScope;
                });

                const oFunction = this.oModel.bindContext("/createVariant(...)");
                oFunction.setParameter("Flag", oEvent.getParameters().overwrite ? "E" : "X");
                oFunction.setParameter("USER", this.oGModel.getProperty("/UserId"));
                oFunction.setParameter("VARDATA", JSON.stringify(dataArray));

                const oCtx = await oFunction.execute().then(() => oFunction.getBoundContext());
                const result = JSON.parse(oCtx.getObject().value.value);

                this.oGModel.setProperty("/newVariant", result);
                this.oGModel.setProperty("/newVaraintFlag", "X");
                this.byId("idMatListVPD").setModified(false);
                this.onAfterRendering();

            } catch (err) {
                console.error("Variant creation failed", err);
                sap.m.MessageToast.show("Failed to create variant");
            } finally {
                sap.ui.core.BusyIndicator.hide();
            }
        },
        onManage: async function (oEvent) {
            sap.ui.core.BusyIndicator.show();

            const totalVariantData = this.oGModel.getProperty("/VariantData");
            const selected = oEvent.getParameters();
            const variantUser = this.getUser()?.toLowerCase();

            try {
                // Deleted Variants
                if (selected.deleted?.length) {
                    const deletedArray = totalVariantData
                        .filter(item => selected.deleted.includes(String(item.VARIANTID)))
                        .map(item => ({ ID: item.VARIANTID, NAME: item.VARIANTNAME }));

                    if (deletedArray.length) {
                        const delFunc = this.oModel.bindContext("/createVariant(...)");
                        delFunc.setParameter("Flag", "D");
                        delFunc.setParameter("USER", variantUser);
                        delFunc.setParameter("VARDATA", JSON.stringify(deletedArray));
                        await delFunc.execute();
                    }
                }

                // Update default variant
                if (selected.def) {
                    const defId = JSON.parse(selected.def);
                    const isStandard = defId === 0;

                    if (!isStandard) {
                        const defFunc = this.oModel.bindContext("/updateVariant(...)");
                        const newDefault = totalVariantData
                            .filter(item => item.VARIANTID === defId)
                            .map(v => ({ ...v, DEFAULT: "Y" }));

                        defFunc.setParameter("VARDATA", JSON.stringify(newDefault));
                        await defFunc.execute();
                    }
                }

                this.onAfterRendering();

            } catch (err) {
                console.error("Error managing variants", err);
                sap.m.MessageToast.show("Failed to manage variants");
            } finally {
                sap.ui.core.BusyIndicator.hide();
            }
        },
        handleSelectPress: async function (oEvent) {
            sap.ui.core.BusyIndicator.show();

            try {
                const oVariantDetails = this.oGModel.getProperty("/variantDetails") || [];
                const appName = this.getOwnerComponent().getManifestEntry("/sap.app/id");
                const oView = this.getView();

                let selectedVariantName =
                    typeof oEvent === "string"
                        ? oEvent
                        : oEvent?.getSource?.().getTitle?.().getText?.() || "Standard";

                this.oGModel.setProperty("/variantName", selectedVariantName);
                this.finaloTokens = [];
                this.oGModel.setProperty("/defaultLocation", []);
                this.oGModel.setProperty("/defaultProduct", []);

                // --- Standard Variant (reset to default UI) ---
                if (selectedVariantName === "Standard") {
                    ["alertsPanel", "lagsPanel", "idRow4"].forEach(id =>
                        oView.byId(id).setVisible(true)
                    );
                    sap.m.MessageToast.show("Standard View Loaded");
                    return;
                }

                // --- Fetch matching variant data ---
                const filteredData = oVariantDetails.filter(item =>
                    item.VARIANTNAME === selectedVariantName &&
                    item.APPLICATION_NAME === appName
                );

                // --- Filters ---
                const locData = filteredData.filter(f => f.FIELD === "Location");
                const prodData = filteredData.filter(f => f.FIELD === "Product");

                // --- Panel visibility ---
                const alertsVisible = filteredData.find(f => f.FIELD === "ALERTS_VISIBLE")?.VALUE === "true";
                const lagsVisible = filteredData.find(f => f.FIELD === "LAGS_VISIBLE")?.VALUE === "true";
                const forecastVisible = filteredData.find(f => f.FIELD === "FORECAST_VISIBLE")?.VALUE === "true";

                oView.byId("alertsPanel").setVisible(alertsVisible ?? true);
                oView.byId("lagsPanel").setVisible(lagsVisible ?? true);
                oView.byId("idRow4").setVisible(forecastVisible ?? true);

                // --- Apply filters ---
                if (locData.length) {
                    const sLocValue = locData[0].VALUE;
                    oView.byId("LocationSelect").setSelectedKey(sLocValue);
                    this.oGModel.setProperty("/defaultLocation", sLocValue);
                    locData.forEach(d => this.finaloTokens.push({ FIELD: d.FIELD, VALUE: d.VALUE }));
                }

                if (prodData.length) {
                    const sProdValue = prodData[0].VALUE;
                    oView.byId("productSelect").setSelectedKey(sProdValue);
                    this.oGModel.setProperty("/defaultProduct", sProdValue);
                    prodData.forEach(d => this.finaloTokens.push({ FIELD: d.FIELD, VALUE: d.VALUE }));
                }

                sap.m.MessageToast.show(`Loaded Variant: ${selectedVariantName}`);

            } catch (err) {
                console.error("Error applying variant", err);
                sap.m.MessageToast.show("Error applying selected variant");
            } finally {
                sap.ui.core.BusyIndicator.hide();
            }
        },




    });
});

