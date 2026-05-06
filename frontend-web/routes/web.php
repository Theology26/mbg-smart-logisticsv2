<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return redirect()->route('login');
});

Route::get('/login', function () {
    return Inertia::render('Auth/Login');
})->name('login');

Route::get('/dashboard', function () {
    return Inertia::render('Dashboard/Summary');
})->name('dashboard');

Route::get('/dashboard/map', function () {
    return Inertia::render('Dashboard/Map');
})->name('map');

Route::get('/dashboard/schedules', function () {
    return Inertia::render('Dashboard/Schedules');
})->name('schedules');

Route::get('/dashboard/deliveries', function () {
    return Inertia::render('Dashboard/Deliveries');
})->name('deliveries');

Route::get('/dashboard/schools', function () {
    return Inertia::render('Dashboard/Schools');
})->name('schools');

Route::get('/dashboard/ingredients', function () {
    return Inertia::render('Dashboard/Ingredients');
})->name('ingredients');

Route::get('/dashboard/customization', function () {
    return Inertia::render('Dashboard/Customization');
})->name('customization');

Route::get('/dashboard/system-settings', function () {
    return Inertia::render('Dashboard/SystemSettings');
})->name('system-settings');

